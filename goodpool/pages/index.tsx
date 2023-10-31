import { ConnectButton } from '@rainbow-me/rainbowkit';
import type { NextPage } from 'next';
import Image from 'next/image';
import logo from '../public/logo.png'
import Head from 'next/head';
import React, { useEffect, useState } from 'react';
import { useConnect, useNetwork, useAccount } from 'wagmi'
import { getPublicClient } from '@wagmi/core'
import { ethers } from "ethers";
import { Alchemy } from "alchemy-sdk"
import { InjectedConnector } from 'wagmi/connectors/injected'
import { InstantDistributionAgreementV1 } from "@superfluid-finance/sdk-core";
import { GOODPOOL_SMART_CONTRACT, GOODPOOL_IDA_INDEX, GOODPOOL_ACCEPTED_TOKEN_ADDRESS, IDA_V1_SMART_CONTRACT} from '../constants/constants';
import { useGlobalContext } from '../globalContext/GlobalContext';
import { ApprovalOverlay } from '../components/Approve';
import { useDerived } from "../apollo/apollo";
import { toast } from 'react-toastify';

declare global {
  interface Window {
    ethereum: any;
  }
}

const Home: NextPage = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const { address, status, isConnected, isDisconnected } = useAccount()
  const { error, loading, data } = useDerived();
  const {
    hasStaked,
    displayApprovalModal,
    currentEpoch,
    totalStaked,
    currentStaked,
    guaranteedWinnings,
    goodPoolContractInstance,
    provider,
    timeLeft,
    isOwner,
    feeAmount,
    setFunctionCalled
  } = useGlobalContext();
  
  const [isDashboard, setIsDashboard] = useState(false);

  const [firstPlace, setFirstPlace] = useState("");
  const [secondPlace, setSecondPlace] = useState("");
  const [thirdPlace, setThirdPlace] = useState("");

  const [toBeStaked, setToBeStaked] = useState("");
  const [gBalance, setGBalance] = useState("5");
  const [gas, setGas] = useState("");

	const [isStakeLoading, setIsStakeLoading] = useState(false);
	const [isUnstakeLoading, setIsUnstakeLoading] = useState(false);
	const [isWithdrawing, setIsWithdrawing] = useState(false);
	const [isPickingWinners, setIsPickingWinners] = useState(false);

  // TOAST MESSAGES

  // For success message
  //toast.success("Transaction succeeded!");

  // For error message
  //toast.error("Transaction failed!");

  // For informational message
  //toast.info("Your balance is low.");
  
  const pickWinners = async() => {
    setIsPickingWinners(true)
    // Shuffle function to randomize the array
    function shuffleArray(array: string[]): void {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]]; // Swap elements
        }
    }

    try {
        const allStakers = await goodPoolContractInstance.getAllStakerAddresses();
        const currentEpochStakers = [];

        // Check each staker if they have staked in the current epoch
        for (let stakerAddress of allStakers) {
            const stakerDetail = await goodPoolContractInstance.stakerDetails(stakerAddress);
            if (stakerDetail.epoch.toString() === currentEpoch.toString()) {
                currentEpochStakers.push(stakerAddress);
            }
        }

        const totalWinners = currentEpochStakers.length;
        let winningWallets: string[] = [];
        let winningsAmount: number[] = [];

        const firstPlace = Math.ceil(0.4 * totalStaked);
        const secondPlace = Math.ceil(0.25 * totalStaked);
        const thirdPlace = Math.ceil(0.1 * totalStaked);
        const remainingWinnings = Math.ceil(0.2 * totalStaked);

        if (totalWinners <= 3) {
            // Handle cases of 1, 2, or 3 stakers
            winningWallets = currentEpochStakers;
            if (totalWinners === 1) {
              winningsAmount = [Math.ceil(totalStaked)];
            } else if (totalWinners === 2) {
                winningsAmount = [Math.ceil(0.8 * totalStaked), Math.ceil(0.2 * totalStaked)];
            } else if (totalWinners === 3) {
                winningsAmount = [Math.ceil(0.6 * totalStaked), Math.ceil(0.25 * totalStaked), Math.ceil(0.15 * totalStaked)];
            }
        } else {
            // Handle cases of more than 3 stakers
            shuffleArray(currentEpochStakers);
            let firstWinner = currentEpochStakers[0];
            let secondWinner = currentEpochStakers[1];
            let thirdWinner = currentEpochStakers[2];

            const restStakersCount = totalWinners - 3;
            const equalShare = Math.ceil(remainingWinnings / restStakersCount);

            winningWallets = [firstWinner, secondWinner, thirdWinner, ...currentEpochStakers.slice(3)];
            winningsAmount = [firstPlace, secondPlace, thirdPlace, ...Array(restStakersCount).fill(equalShare)];
        }

        // Ensure winnings don't exceed available tokens due to floating point errors
        const totalWinnings = winningsAmount.reduce((a, b) => a + b, 0);
        if (totalWinnings > totalStaked) {
            let difference = totalWinnings - totalStaked;
            winningsAmount[winningWallets.length - 1] -= difference; // Adjust from the last winner
        }

        if (winningWallets.length > 0) setFirstPlace(winningWallets[0]);
        if (winningWallets.length > 1) setSecondPlace(winningWallets[1]);
        if (winningWallets.length > 2) setThirdPlace(winningWallets[2]);

        console.log("winningWallets", winningWallets);
        console.log("winningsAmount", winningsAmount);

        const distributeWinnings = await goodPoolContractInstance.distributePool(winningWallets, winningsAmount);

        // Wait for the transaction to be mined
        const txnReceipt = await distributeWinnings.wait();

        if (txnReceipt.status === 1) {
          console.log("Transaction succeeded!");
          toast.success("Winnings Successfully Distributed", {position: toast.POSITION.BOTTOM_RIGHT})
          setIsPickingWinners(false)
          setFunctionCalled("winningsDistributed")
        } else {
          setIsPickingWinners(false)
          toast.error("Failed to Distribute Winnings", {position: toast.POSITION.BOTTOM_RIGHT})
          console.log("Failed to Distribute Winnings");
        }

    } catch (err) {
      setIsPickingWinners(false)
      toast.error("Failed to Distribute Winnings", {position: toast.POSITION.BOTTOM_RIGHT})
      console.log("ERROR SELECTING WINNERS", err);
    }
  }


  const withdrawFee = async() => {
    //console.log(address)

    try {
      setIsWithdrawing(true)

      const withdrawAmount = ethers.utils.parseUnits(feeAmount.toString(), 'ether'); // assuming 18 decimals

      const withdraw = await goodPoolContractInstance.withdrawFee(withdrawAmount);
      
      // Wait for the transaction to be mined
      const txnReceipt = await withdraw.wait();

      if (txnReceipt.status === 1) {
        console.log("Transaction succeeded!");
        toast.success("Tokens Successfully Withdrawn!", {position: toast.POSITION.BOTTOM_RIGHT})
        setIsWithdrawing(false)
        setFunctionCalled("feeWithdrawn")
      } else {
        setIsWithdrawing(false)
        toast.error("Failed to Withdraw", {position: toast.POSITION.BOTTOM_RIGHT})
        console.log("Failed to Withdraw");
      }
    } catch (err) {
      setIsWithdrawing(false)
      toast.error("Failed to Withdraw", {position: toast.POSITION.BOTTOM_RIGHT})
      console.log("FAILED TO WITHDRAW", err)
    }
  }

  const stakeTokens = async() => {
    //console.log(address)

    try {
      setIsStakeLoading(true)

      const stakeAmount = ethers.utils.parseUnits(toBeStaked.toString(), 'ether'); // assuming 18 decimals

      const stake = await goodPoolContractInstance.stake(stakeAmount);
      
      // Wait for the transaction to be mined
      const txnReceipt = await stake.wait();

      if (txnReceipt.status === 1) {
        console.log("Transaction succeeded!");
        toast.success("Tokens Successfully Staked!", {position: toast.POSITION.BOTTOM_RIGHT})
        setIsStakeLoading(false)
        setFunctionCalled("stakedTokens")
      } else {
        setIsStakeLoading(false)
        toast.error("Failed to Stake", {position: toast.POSITION.BOTTOM_RIGHT})
        console.log("Transaction Failed!");
      }
    } catch (err) {
      setIsStakeLoading(false)
      toast.error("Failed to Stake", {position: toast.POSITION.BOTTOM_RIGHT})
      console.log("FAILED TO STAKE", err)
    }
  }

  const unstakeTokens = async() => {
    //console.log(address)

    try {
      setIsUnstakeLoading(true)

      const unstakeAmount = ethers.utils.parseUnits(currentStaked.toString(), 'ether'); // assuming 18 decimals

      const unstake = await goodPoolContractInstance.unstake(unstakeAmount);
      
			// Wait for the transaction to be mined
			const txnReceipt = await unstake.wait();

      if (txnReceipt.status === 1) {
        console.log("Transaction succeeded!");
        toast.success("Tokens Successfully Unstaked!", {position: toast.POSITION.BOTTOM_RIGHT})
        setIsUnstakeLoading(false)
        setFunctionCalled("unstakedTokens")
      } else {
        setIsUnstakeLoading(false)
        toast.error("Failed to Unstake", {position: toast.POSITION.BOTTOM_RIGHT})
        console.log("Transaction failed!");
      }
    } catch (err) {
      setIsUnstakeLoading(false)
      toast.error("Failed to Unstake", {position: toast.POSITION.BOTTOM_RIGHT})
      console.log("FAILED TO UNSTAKE", err)
    }
  }

  useEffect(() => {
    const simulateTransaction = async () => {
        try {
            if (toBeStaked === "") {
                setGas("0");
                return;
            }

            // 1. Get MATIC price in ETH
            const maticPriceInEth = parseFloat(data.pair.token0.derivedETH);
            //console.log("maticPriceInEth", maticPriceInEth)

            const stakeAmount = ethers.utils.parseUnits(toBeStaked.toString(), 'ether');
            const estimatedGas = await goodPoolContractInstance.estimateGas.stake(stakeAmount);
            
            const gasPrice = await provider.getGasPrice();

            // 2. Get ETH price in USD
            const response = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd");
            const ethQuery = await response.json();
            const ethToUsd = ethQuery.ethereum.usd;

            // 3. Get MATIC price in USD
            const maticPriceInUsd = maticPriceInEth * ethToUsd;
            //console.log("maticPriceInUsd", maticPriceInUsd)

            // 4. Calculate gas cost in MATIC
            const totalCostInMatic = ethers.utils.formatUnits(gasPrice.mul(estimatedGas), 'ether'); 
            //console.log("totalCostInMatic", totalCostInMatic)

            // 5. Get the total cost in USD
            const totalCostInUsd = parseFloat(totalCostInMatic) * maticPriceInUsd;
            //console.log("totalCostInUsd", totalCostInUsd)

            setGas(totalCostInUsd.toFixed(6)); // Consider setting this to a fixed decimal places for better UX

            console.log(`Estimated gas for staking in USD: $${totalCostInUsd.toFixed(2)}`);
        } catch (error) {
            console.error("Failed to estimate gas:", error);
        }
    };
    
    simulateTransaction();

  }, [toBeStaked, goodPoolContractInstance, provider]);

  return (
    <div className="flex h-[100vh] w-full flex-col">
      <Head>
        <title>GoodPool</title>
        <meta
          content="GoodPool"
          name="description"
        />
        <link href="/favicon.ico" rel="icon" />
      </Head>

      <main className="flex w-full h-full justify-center items-center px-8 lg:px-0">
        <div className="flex flex-col gap-12 p-8 w-[900px] border border-blue border-opacity-25 rounded-15">
          <div className="flex gap-8 justify-between items-center">
            <div className="flex items-center gap-2">
                <Image src={logo} width={32} height={32} alt='GoodPool Logo' />
                <div className="text-blue text-medium">GoodPool</div>
            </div>
            
            {/* Normal navigation items - hidden on small screens */}
            <div className="hidden md:flex gap-2 items-center">
                {isOwner && (
                    <div onClick={() => { setIsDashboard(!isDashboard) }}
                         className="shadow-md text-center rounded-15 py-2 px-4 font-bold hover:cursor-pointer hover:scale-105 transition">
                        {isDashboard ? "Home" : "Dashboard"}
                    </div>
                )}
                <ConnectButton />
            </div>

            {/* Burger icon - shown only on small screens */}
            <button 
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="md:hidden text-[28px]">
                ☰
            </button>

            {/* Burger menu items */}
            {isMenuOpen && (
                <div className="absolute top-0 right-0 bg-white shadow-lg rounded-md p-4 z-50 md:hidden w-full h-full flex flex-col py-12 justify-between text-center items-center">
                    {isOwner && (
                        <div onClick={() => { setIsDashboard(!isDashboard), setIsMenuOpen(!isMenuOpen) }}
                             className="shadow-md w-[200px] text-center rounded-15 py-2 px-4 font-bold hover:cursor-pointer hover:scale-105 transition mb-4">
                            {isDashboard ? "Home" : "Dashboard"}
                        </div>
                    )}
                    <div className="flex flex-col justify-center items-center gap-8">
                      <ConnectButton />
                      <div onClick={() => { setIsMenuOpen(!isMenuOpen) }}
                        className="shadow-md w-[200px] text-center rounded-15 py-2 px-4 font-bold hover:cursor-pointer hover:scale-105 transition mb-4">
                        Close
                      </div>
                    </div>
                </div>
            )}
          </div>

          {isDashboard ?
              <div className="flex flex-col w-full h-full justify-center items-center gap-8">
                <div className="flex sm:flex-col md:flex-row sm:gap-2 md:gap-0 w-full justify-between items-center base:px-6">
                  <div className="w-full flex justify-between">
                    <div className="flex flex-col gap-2 items-center">
                      <div className="text-xsmall font-bold opacity-75">Current Epoch</div>
                      <div className="text-[24px] font-bold">{currentEpoch ? currentEpoch : "0"}</div>
                    </div>
                    <div className="flex flex-col gap-2 items-center pr-[10px] sm:hidden md:flex">
                      <div className="text-xsmall font-bold opacity-75">GoodPool Pot</div>
                      <div className="text-[24px] font-bold">{totalStaked ? totalStaked : "0"} $G</div>
                    </div>
                    <div className="flex flex-col gap-2 items-center">
                      <div className="text-xsmall font-bold opacity-75">Next Epoch</div>
                      <div className="text-medium font-bold">{timeLeft.hours}:{timeLeft.minutes}:{timeLeft.seconds}</div>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 items-center pr-[10px] md:hidden">
                      <div className="text-xsmall font-bold opacity-75">GoodPool Pot</div>
                      <div className="text-[24px] font-bold">{totalStaked ? totalStaked : "0"} $G</div>
                  </div>
                </div>
                <div className="font-bold text-medium justify-center items-center w-full flex">Generate Winner</div>
                <div className="flex flex-col gap-4 w-full">
                  <div className="w-full flex justify-between font-bold opacity-75">
                    <div>Winner</div>
                    <div>Winnings</div> 
                  </div>
                  <div className="flex w-full justify-between items-center font-bold">
                    <div className="flex gap-2 justify-center items-center">
                      <div className="bg-green rounded-[5px] py-2 px-4 text-white">1st</div>
                      <div>{firstPlace ? firstPlace : "0x0"}</div>
                    </div>
                    <div>40%</div>
                  </div>
                  <div className="flex w-full justify-between items-center font-bold">
                    <div className="flex gap-2 justify-center items-center">
                      <div className="bg-green bg-opacity-75 rounded-[5px] py-2 px-[13px] text-white">2nd</div>
                      <div>{secondPlace ? secondPlace : "0x0"}</div>
                    </div>
                    <div>25%</div>
                  </div> 
                  <div className="flex w-full justify-between items-center font-bold">
                    <div className="flex gap-2 justify-center items-center">
                      <div className="bg-green bg-opacity-50 rounded-[5px] py-2 px-[14.5px] text-white">3rd</div>
                      <div>{thirdPlace ? thirdPlace : "0x0"}</div>
                    </div>
                    <div>15%</div>
                  </div>
                  <div className="flex w-full justify-between items-center font-bold">
                    <div className="flex gap-2 justify-center items-center">
                      <div className="bg-green bg-opacity-50 rounded-[5px] py-2 px-[14.5px] text-white">Everyone else</div>
                    </div>
                    <div>20%</div>
                  </div>
                </div>
                
                <button disabled={isPickingWinners} className={`${isPickingWinners ? "opacity-75" : ""} w-full bg-blue rounded-15 text-center text-white py-2 hover:cursor-pointer`} onClick={pickWinners}>{isPickingWinners ? "Generating Winners..." : "Pick winners"}</button>

                <div className="flex w-full justify-between items-center font-bold opacity-75">
                  <div>Total Fees Generated</div>
                  <div>{feeAmount ? feeAmount : "0"} $G</div>
                </div>

                <button disabled={isWithdrawing} className={`${isWithdrawing ? "opacity-75" : ""} w-full bg-green rounded-15 text-center text-white py-2 hover:cursor-pointer`} onClick={withdrawFee}>{isWithdrawing ? "Withdrawing..." : "Withdraw Fees"}</button>
              </div>
          :
            <div className="flex w-full h-full relative">

              {displayApprovalModal && (
                <ApprovalOverlay />
              )}

              <div className="flex flex-col gap-8 w-full">
                <div className="flex flex-col gap-6 w-full">
                  <div className="flex sm:flex-col md:flex-row sm:gap-2 md:gap-0 w-full justify-between items-center base:px-6">
                    <div className="w-full flex justify-between">
                      <div className="flex flex-col gap-2 items-center">
                        <div className="text-xsmall font-bold opacity-75">Current Epoch</div>
                        <div className="text-[24px] font-bold">{currentEpoch ? currentEpoch : "0"}</div>
                      </div>
                      <div className="flex flex-col gap-2 items-center pr-[10px] sm:hidden md:flex">
                        <div className="text-xsmall font-bold opacity-75">GoodPool Pot</div>
                        <div className="text-[24px] font-bold">{totalStaked ? totalStaked : "0"} $G</div>
                      </div>
                      <div className="flex flex-col gap-2 items-center">
                        <div className="text-xsmall font-bold opacity-75">Next Epoch</div>
                        <div className="text-medium font-bold">{timeLeft.hours}:{timeLeft.minutes}:{timeLeft.seconds}</div>
                      </div>
                    </div>
                    <div className="flex flex-col gap-2 items-center pr-[10px] md:hidden">
                        <div className="text-xsmall font-bold opacity-75">GoodPool Pot</div>
                        <div className="text-[24px] font-bold">{totalStaked ? totalStaked : "0"} $G</div>
                    </div>
                  </div>

                  {hasStaked &&
                    <div className="flex flex-col bg-black bg-opacity-5 rounded-15 px-6 py-4 gap-4">
                      <div className="w-full text-center py-2 font-bold text-medium">Overview</div>
                      <div className="flex w-full justify-between items-center text-black font-bold opacity-75">
                        <div>Your Stake</div>
                        <div>{currentStaked ? currentStaked : "0"} $G</div>
                      </div>
                      <div className="flex w-full justify-between items-center text-black font-bold opacity-75">
                        <div>Guaranteed winnings</div>
                        <div>{guaranteedWinnings ? guaranteedWinnings.toFixed(2) : "0"}</div>
                      </div>
                      <button
                        onClick={unstakeTokens}
                        disabled={isUnstakeLoading}
                        className={`${isUnstakeLoading ? "opacity-75 py-2" : ""} text-medium py-2 rounded-15 rounded w-full transition bg-red opacity-90 hover:opacity-100 text-white transition duration-300 ease-in-out"`}
                      >
                        {isUnstakeLoading ? "Loading..." : "Unstake"}
                      </button>
                    </div>
                  }
                  
                  <div className="flex flex-col bg-black bg-opacity-5 rounded-15 px-6 py-4 gap-8 mt-2">
                    <div className="flex flex-col gap-4">
                      <div className="relative w-full">
                        <input 
                            type="text" 
                            value={toBeStaked}
                            onChange={e => {
                                // Allow only numeric values and empty string
                                if (/^(\d*\.?\d*)?$/.test(e.target.value)) {
                                    setToBeStaked(e.target.value);
                                    console.log(e.target.value)
                                }
                            }}
                            className="border border-white rounded-15 focus:outline-none focus:border-blue-500 w-full py-4 px-6"
                            placeholder="Enter amount"
                        />
                        <span 
                            className="absolute right-6 top-1/2 transform -translate-y-1/2 cursor-pointer text-blue-500"
                            onClick={() => setToBeStaked(gBalance)}
                        >
                            Max
                        </span>
                      </div>
                      <button
                        onClick={stakeTokens}
                        disabled={isStakeLoading}
                        className={`${isStakeLoading ? "opacity-75 py-2" : ""} text-medium py-2 rounded-15 bg-green rounded w-full transition text-white transition duration-300 ease-in-out`}
                      >
                        {isStakeLoading ? "Loading..." : "Stake"}
                      </button>
                    </div>
                    <div className="flex flex-col w-full items-center gap-4">
                      {/*<div className="flex w-full justify-between items-center text-black font-bold opacity-75">
                        <div>Guaranteed winnings</div>
                        <div>{guaranteedWinnings ? guaranteedWinnings : "0"}</div>
                          </div>*/}
                      <div className="flex w-full justify-between items-center text-black font-bold opacity-75">
                        <div>Gas</div>
                        <div>{gas ? gas : "0"} USD</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          }
        </div>

      </main>

      <footer className="flex w-full justify-center items-center py-6 ">
        <a href="https://github.com/Heisenburgirs?tab=repositories" rel="noopener noreferrer" target="_blank" className="font-bold opacity-75 border py-2 px-4 border-blue border-opacity-50 rounded-15">
          Made by Heisen🍔
        </a>
      </footer>
    </div>
  );
};

export default Home;
