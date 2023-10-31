// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@chainlink/contracts/src/v0.8/VRFConsumerBase.sol";
import { ISuperfluid, ISuperToken} from "@superfluid-finance/ethereum-contracts/contracts/interfaces/superfluid/ISuperfluid.sol";
import { IInstantDistributionAgreementV1 } from "@superfluid-finance/ethereum-contracts/contracts/interfaces/agreements/IInstantDistributionAgreementV1.sol";
import { SuperTokenV1Library } from "@superfluid-finance/ethereum-contracts/contracts/apps/SuperTokenV1Library.sol";
import { IDAv1Library } from "@superfluid-finance/ethereum-contracts/contracts/apps/IDAv1Library.sol";

contract GoodPool is ReentrancyGuard {

    using SuperTokenV1Library for ISuperToken;
    using IDAv1Library for IDAv1Library.InitData;
    IDAv1Library.InitData public idaV1;

    ISuperToken public token;

    uint32 public constant INDEX_ID = 0;

    struct StakerInfo {
        uint256 stakedAmount;
        uint256 winAmount;
        uint256 epoch;
    }

    address public owner;
    uint256 public totalStaked;
    uint256 public currentEpoch = 0;
    uint256 public epochTimestamp;
    uint256 public epochDuration = 24 hours;
    uint256 public fee = 2;
    uint256 public feeAmount = 0;
    // Track the previous winners
    address[] private previousWinners;

    address[] private stakerAddresses; // Array of all staker addresses
    mapping(address => StakerInfo) public stakerDetails; // Mapping from address to its staking details
    mapping(address => bool) public isStaker; // Check if user has staked before

    event Staked(address indexed user, uint256 amount);
    event Unstaked(address indexed user, uint256 amount);

    modifier onlyOwner() {
        require(msg.sender == owner, "Not the contract owner");
        _;
    }

    constructor(ISuperToken _token, ISuperfluid _host) {
        owner = msg.sender;
        
        token = _token;

        // Initializing the host and agreement type in idaV1 object so the object can  have them on hand for enacting IDA functions
        idaV1 = IDAv1Library.InitData(
            _host,
            IInstantDistributionAgreementV1(
                address(_host.getAgreementClass(keccak256("org.superfluid-finance.agreements.InstantDistributionAgreement.v1")))
            )
        );

        idaV1.createIndex(_token, INDEX_ID);

        epochTimestamp = block.timestamp;
    }

    function distributeIDA(uint256 amount) private {
        // Ensure you don't distribute more than the balance
        uint256 contractTokenBalance = token.balanceOf(address(this));
        require(contractTokenBalance >= amount, "Insufficient funds");

        (uint256 actualDistributionAmount,) = idaV1.ida.calculateDistribution(
            token,
            address(this),
            INDEX_ID,
            amount
        );

        idaV1.distribute(token, INDEX_ID, actualDistributionAmount);
    }

    function addShares(address subscriber, uint256 winning) private {

        // Get current units subscriber holds
        (,,uint256 currentUnitsHeld,) = idaV1.getSubscription(
            token,
            address(this),
            INDEX_ID,
            subscriber
        );

        // Ensure the new units will fit in a uint128
        require(currentUnitsHeld + winning <= type(uint128).max, "Exceeds uint128 limit");

        // Update to current amount plus winning
        idaV1.updateSubscriptionUnits(
            token,
            INDEX_ID,
            subscriber,
            uint128(currentUnitsHeld + winning)
        );
    }

    function removeShares(address subscriber) private {

        // Update to current amount plus winning
        idaV1.updateSubscriptionUnits(
            token,
            INDEX_ID,
            subscriber,
            0
        );
    }

    // Allows an account to delete its entire subscription
    // subscriber - address whose subscription is to be deleted
    function deleteShares(address subscriber) private {
        idaV1.deleteSubscription(
            token,
            address(this),
            INDEX_ID,
            subscriber
        );
    }

    function distributePool(address[] memory winners, uint256[] memory prizes) external onlyOwner {
        require(winners.length == prizes.length, "Winners and prizes length mismatch");
        // Ensure that current time is at least 24 hours later than the previous epochTimestamp
        require(block.timestamp >= epochTimestamp + epochDuration, "Cannot distribute yet");

        for (uint i = 0; i < winners.length; i++) {
            require(stakerDetails[winners[i]].epoch == currentEpoch, "Winner did not stake in current epoch");
            addShares(winners[i], prizes[i]);
        }

        uint256 totalPrize = 0;
        
        for (uint i = 0; i < winners.length; i++) {
            totalPrize += prizes[i];
        }

        uint256 poolSizeForDistribution = getPoolSizeForDistribution();
        require(poolSizeForDistribution >= totalPrize, "Insufficient pool size for distribution");

        // Set subscriptions of previous winners to 0
        for (uint i = 0; i < previousWinners.length; i++) {
            removeShares(previousWinners[i]);
        }

        // Add shares for the winners based on their prize
        for (uint i = 0; i < winners.length; i++) {
            addShares(winners[i], prizes[i]);
        }

        // Distribute the pool to the winners
        distributeIDA(poolSizeForDistribution);

        // Store the new winners in previousWinners for next time
        previousWinners = winners;

        // Move to the next epoch
        currentEpoch += 1;

        // Update the feeAmount
        uint256 feeForEpoch = totalStaked - poolSizeForDistribution;
        feeAmount += feeForEpoch;

        // Reset totalStaked
        totalStaked = 0;

        // Set new timestamp
        epochTimestamp = block.timestamp;
    }

    function stake(uint256 amount) external {
        require(amount > 0, "Amount should be greater than 0");
        require(token.transferFrom(msg.sender, address(this), amount), "Transfer failed");

        StakerInfo storage staker = stakerDetails[msg.sender];
        
        // If the user is not already a staker, add their address to stakerAddresses
        if (!isStaker[msg.sender]) {
            stakerAddresses.push(msg.sender);
            isStaker[msg.sender] = true;
        }

        // If it's the user's first time staking for this epoch, update their details
        if (staker.epoch != currentEpoch) {
            staker.stakedAmount = 0;  // Reset for new epoch
            staker.epoch = currentEpoch; // Update epoch
        }

        staker.stakedAmount += amount;    
        totalStaked += amount;

        emit Staked(msg.sender, amount);
    }

    function unstake(uint256 amount) external nonReentrant {
        StakerInfo storage staker = stakerDetails[msg.sender];
        
        require(amount > 0, "Amount should be greater than 0");
        require(staker.stakedAmount >= amount, "Insufficient staked amount");

        staker.stakedAmount -= amount;
        totalStaked -= amount;

        require(token.transfer(msg.sender, amount), "Transfer failed");
        emit Staked(msg.sender, amount);
    }

    function withdrawFee(uint256 amount) external onlyOwner nonReentrant {
        require(amount > 0, "Amount should be greater than 0");
        require(amount <= feeAmount, "Amount exceeds available fee");
        
        token.transfer(msg.sender, amount);
        feeAmount -= amount;
    }

    // Getter Functions
    function getPoolSizeForDistribution() public view returns (uint256) {
        return totalStaked * (100 - fee) / 100;
    }

    function getAllStakerAddresses() external view returns(address[] memory) {
        return stakerAddresses;
    }
}
