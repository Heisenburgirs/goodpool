import { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { ethers } from 'ethers'
import { Framework } from "@superfluid-finance/sdk-core"
import { useAccount, useNetwork } from 'wagmi';
import { GOODPOOL_SMART_CONTRACT, GOODPOOL_IDA_INDEX, GOODPOOL_ACCEPTED_TOKEN_ADDRESS, IDA_V1_SMART_CONTRACT} from '../constants/constants';

import ABI from '../constants/abi.json';
import IDA_ABI from '../constants/ida_abi.json';
import TOKEN_ABI from '../constants/token_abi.json';
import { fromWeiToEther, toHumanReadable } from '../utils/utils';

type GlobalProviderContextType = {
  goodPoolContractInstance: any;
  idaContractInstance: any;
  tokenContractInstance: any;
  signer: any;
  superSigner: any;
  sf: any;
  superToken: any;
	hasApprovedContract: any;
	currentEpoch: any;
  setCurrentEpoch: React.Dispatch<React.SetStateAction<number>>;
	totalStaked: any;
  setTotalStaked: React.Dispatch<React.SetStateAction<number>>;
	currentStaked: any;
  setCurrentStaked: React.Dispatch<React.SetStateAction<number>>;
	guaranteedWinnings: any;
  setGuaranteedWinnings: React.Dispatch<React.SetStateAction<number>>;
	hasApprovedToken: any;
	displayApprovalModal: any;
  setDisplayApprovalModal: React.Dispatch<React.SetStateAction<boolean>>;
  setHasApprovedToken: React.Dispatch<React.SetStateAction<boolean>>;
  setHasApprovedContract: React.Dispatch<React.SetStateAction<boolean>>;
	hasStaked: any;
  setHasStaked: React.Dispatch<React.SetStateAction<boolean>>;
	provider: any;
	functionCalled: any;
  setFunctionCalled: React.Dispatch<React.SetStateAction<string>>;
	timeLeft: any;
	isOwner: any;
	feeAmount: any;
};

const defaultContextValue: GlobalProviderContextType = {
  goodPoolContractInstance: null,
  idaContractInstance: null,
  tokenContractInstance: null,
  signer: null,
  superSigner: null,
  sf: null,
  superToken: null,
	hasApprovedContract: false,
	hasApprovedToken: false,
	displayApprovalModal: false,
  setDisplayApprovalModal: () => {},
  setHasApprovedToken: () => {},
  setHasApprovedContract: () => {},
	currentEpoch: 0,
	setCurrentEpoch: () => {},
	totalStaked: 0,
	setTotalStaked: () => {},
	currentStaked: 0,
	setCurrentStaked: () => {},
	guaranteedWinnings: 0,
	setGuaranteedWinnings: () => {},
	hasStaked: false,
	setHasStaked: () => {},
	provider: null,
	functionCalled: "",
	setFunctionCalled: () => {},
	timeLeft: null,
	isOwner: false,
	feeAmount: 0,
};

export const GlobalProvider = createContext<GlobalProviderContextType>(defaultContextValue);

export const useGlobalContext = () => {
  const context = useContext(GlobalProvider);
  if (!context) {
    throw new Error("useGlobalContext must be used within a GlobalwProviderComponent");
  }
  return context;
};

export const GlobalwProviderComponent = ({ children }: { children: ReactNode }) => {

  const { chain } = useNetwork();
  const { address, status, isConnected, isDisconnected } = useAccount();
	const [provider, setProvider] = useState<any>()

  const [isOwner, setIsOwner] = useState(false);
  const [feeAmount, setFeeAmount] = useState(0);

  const [goodPoolContractInstance, setGoodPoolContractInstance] = useState<any>(null);
  const [idaContractInstance, setIdaContractInstance] = useState<any>(null);
  const [tokenContractInstance, setTokenContractInstance] = useState<any>(null);
  const [signer, setSigner] = useState<any>(null);
  const [superSigner, setSuperSigner] = useState<any>(null);
  const [sf, setSf] = useState<any>(null);
  const [superToken, setSuperToken] = useState<any>(null);
  const [hasApprovedToken, setHasApprovedToken] = useState(false);
  const [hasApprovedContract, setHasApprovedContract] = useState(false);
  const [displayApprovalModal, setDisplayApprovalModal] = useState(false);

  const [hasStaked, setHasStaked] = useState(false);
  const [currentEpoch, setCurrentEpoch] = useState(0);
  const [totalStaked, setTotalStaked] = useState(0);
  const [currentStaked, setCurrentStaked] = useState(0);
  const [guaranteedWinnings, setGuaranteedWinnings] = useState(0);
	
	const [functionCalled, setFunctionCalled] = useState("")

	const [timeLeft, setTimeLeft] = useState({ hours: 0, minutes: 0, seconds: 0 });
	
  useEffect(() => {
    const setupSuperfluid = async () => {
      // Check if window.ethereum exists (i.e., MetaMask or other dapp browser is installed)
      if (typeof window.ethereum !== 'undefined') {
        const web3Provider = new ethers.providers.Web3Provider(window.ethereum);
				setProvider(web3Provider)

				if (address) {
					const signerInstance = web3Provider.getSigner();
					
					// Proceed with Superfluid operations using the provider
					const sfInstance = await Framework.create({
						chainId: 80001,
						provider: web3Provider 
					});

					const superSignerInstance = sfInstance.createSigner({ signer: signerInstance });

					if (!superToken) {
						const superTokenInstance = await sfInstance.loadSuperToken("fDAIx");
						setSuperToken(superTokenInstance);
					}

					const goodPoolContract = new ethers.Contract(GOODPOOL_SMART_CONTRACT, ABI, signerInstance);
					const idaContract = new ethers.Contract(IDA_V1_SMART_CONTRACT, IDA_ABI, web3Provider);
					const tokenContract = new ethers.Contract(GOODPOOL_ACCEPTED_TOKEN_ADDRESS, TOKEN_ABI, signerInstance);

					setGoodPoolContractInstance(goodPoolContract);
					setIdaContractInstance(idaContract);
					setTokenContractInstance(tokenContract);
					setSigner(signerInstance);
					setSuperSigner(superSignerInstance);
					setSf(sfInstance);

					const isWalletOwner = await goodPoolContract.owner()

					if (address === isWalletOwner) {
						setIsOwner(true)
					} else {
						setIsOwner(false)
					}

					const totalFeeAmount = await goodPoolContract.feeAmount()

					//console.log("totalFeeAmount", totalFeeAmount.toString());
					setFeeAmount(totalFeeAmount.toString())

					//console.log("address", address);
					//console.log("isWalletOwner", isWalletOwner);

					const hasApprovedContractQuery = await idaContract.getSubscription(
						GOODPOOL_ACCEPTED_TOKEN_ADDRESS,
						GOODPOOL_SMART_CONTRACT,
						GOODPOOL_IDA_INDEX,
						address
					)

					//console.log(hasApprovedContract[1])

					// Approval modal logic
					if (hasApprovedContractQuery[1]) {
						setHasApprovedContract(true);
					}

					const hasApprovedTokenContract = await tokenContract.allowance(
						address,
						GOODPOOL_SMART_CONTRACT,
					)

					console.log("hasApprovedTokenContract", hasApprovedTokenContract._hex)

					if (hasApprovedTokenContract._hex != 0x00) {
						setHasApprovedToken(true);
					}

					if (hasApprovedContractQuery[1]) {
						if(hasApprovedTokenContract._hex != 0x00){
							setDisplayApprovalModal(false);
						}
					} else {
						setDisplayApprovalModal(true);
					}

					/***  Fetch current state of GoodPool Contract ***/
					// currentEpoch totalStaked currentStaked guaranteedWinnings

					//  Current Epoch
					const currentEpochQuery = await goodPoolContract.currentEpoch();

					//console.log("currentEpoch", currentEpochQuery.toString());

					setCurrentEpoch(currentEpochQuery.toString());

					// Total staked - fee
					const totalStakedQuery = await goodPoolContract.getPoolSizeForDistribution();

					//console.log("totalStakedQuery", totalStakedQuery.toString())

					setTotalStaked(fromWeiToEther(totalStakedQuery.toString()));

					// currentStaked for connected user
					
					const currentStakedQuery = await goodPoolContract.stakerDetails(address);

					//console.log("currentStakedQuery", currentStakedQuery);

					const currentStakedQueryEpoch = currentStakedQuery.epoch;
					const currentStakedQueryStakedAmount = currentStakedQuery.stakedAmount;

					if (currentStakedQueryEpoch == currentEpochQuery.toString() && currentStakedQueryStakedAmount.gt(ethers.constants.Zero)) {
						setHasStaked(true);
						setCurrentStaked(fromWeiToEther(currentStakedQueryStakedAmount.toString()));
					} else {
						setHasStaked(false);
					}

					const allStakers = await goodPoolContract.getAllStakerAddresses();
					//console.log("allStakers", allStakers)
					const currentEpochStakers = [];
			
					// Check each staker if they have staked in the current epoch
					for (let stakerAddress of allStakers) {
						const stakerDetail = await goodPoolContract.stakerDetails(stakerAddress);
						if (stakerDetail.epoch.toString() === currentEpochQuery.toString()) {
							currentEpochStakers.push(stakerAddress);
						}
					}
			
					// Determine guaranteed winnings
					let winnings = 0;
					const numberOfStakers = currentEpochStakers.length;
					//console.log("currentEpochStakers", currentEpochStakers)
					const userStake = fromWeiToEther(currentStakedQueryStakedAmount.toString());
			
					if (numberOfStakers === 1) {
						winnings = fromWeiToEther(totalStakedQuery.toString());  // Assuming totalStaked is in Ether (or the relevant token)
					} else if (numberOfStakers === 2) {
						winnings = (address === currentEpochStakers[0]) ? 0.8 * totalStaked : 0.2 * totalStaked;
					} else if (numberOfStakers === 3) {
						if (address === currentEpochStakers[0]) {
							winnings = 0.6 * totalStaked;
						} else if (address === currentEpochStakers[1]) {
							winnings = 0.25 * totalStaked;
						} else {
							winnings = 0.15 * totalStaked;
						}
					} else if (numberOfStakers > 3) {
						if (address === currentEpochStakers[0]) {
							winnings = 0.4 * totalStaked;
						} else if (address === currentEpochStakers[1]) {
							winnings = 0.25 * totalStaked;
						} else if (address === currentEpochStakers[2]) {
							winnings = 0.1 * totalStaked;
						} else {
							winnings = (0.2 * totalStaked) / (numberOfStakers - 3); // Divide the 20% amongst the rest
						}
					}
					
					//console.log("winnings", winnings)
					setGuaranteedWinnings(winnings);

					// fetch timestamp
					const epochTimestamp = await goodPoolContract.epochTimestamp();
					// convert to js 
					const epochDate = new Date(epochTimestamp * 1000);
					// calculate deadline
					const deadline = new Date(epochDate.getTime() + 24*60*60*1000);
					// calculate difference
					const now = new Date();
					const timeDifference = deadline.getTime() - now.getTime();

					const hours = Math.floor(timeDifference / (1000 * 60 * 60));
					const minutes = Math.floor((timeDifference % (1000 * 60 * 60)) / (1000 * 60));
					const seconds = Math.floor((timeDifference % (1000 * 60)) / 1000);
					
					setTimeLeft({ hours, minutes, seconds });
				
				} else {
					console.error("Please install MetaMask or another Ethereum-compatible browser.");
				}
			}
    };
		

    setupSuperfluid();
  }, [address, status, isConnected, isDisconnected, totalStaked, functionCalled]);

	useEffect(() => {
		// Start countdown
		const intervalId = setInterval(() => {
				setTimeLeft(prevTime => {
						let { hours, minutes, seconds } = prevTime;

						if (seconds > 0) {
								seconds -= 1;
						} else if (minutes > 0) {
								minutes -= 1;
								seconds = 59;
						} else if (hours > 0) {
								hours -= 1;
								minutes = 59;
								seconds = 59;
						}

						return { hours, minutes, seconds };
				});
		}, 1000);

		// Clear interval on component unmount
		return () => clearInterval(intervalId);
}, [address, status, isDisconnected]);

  return (
    <GlobalProvider.Provider
      value={{
        goodPoolContractInstance,
        idaContractInstance,
        tokenContractInstance,
        signer,
        superSigner,
        sf,
        superToken,
				hasApprovedToken,
				hasApprovedContract,
				setHasApprovedToken,
				setHasApprovedContract,
				displayApprovalModal,
				setDisplayApprovalModal,
				currentEpoch,
				setCurrentEpoch,
				totalStaked,
				setTotalStaked,
				currentStaked,
				setCurrentStaked,
				guaranteedWinnings,
				setGuaranteedWinnings,
				hasStaked,
				setHasStaked,
				provider,
				functionCalled,
				setFunctionCalled,
				timeLeft,
				isOwner,
				feeAmount
			}}
    >
      {children}
    </GlobalProvider.Provider>
  );
};

export default GlobalProvider;