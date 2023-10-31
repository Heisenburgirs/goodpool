import React, { useState } from 'react';
import { useGlobalContext } from '../globalContext/GlobalContext';
import { GOODPOOL_SMART_CONTRACT, GOODPOOL_IDA_INDEX} from '../constants/constants';
import { ethers } from 'ethers'
import { toast } from 'react-toastify';

export const ApprovalOverlay = () => {
  const { setDisplayApprovalModal, tokenContractInstance, idaContractInstance, signer, superSigner, sf, superToken, hasApprovedContract, hasApprovedToken, setHasApprovedContract, setHasApprovedToken  } = useGlobalContext();

	const [isContractLoading, setIsContractLoading] = useState(false);
	const [isTokenLoading, setIsTokenLoading] = useState(false);

	const [successModal, setSuccessModal] = useState(false);

	const approveContract = async() => {

		//console.log(address)

		try {
			setIsContractLoading(true)

			const approve = superToken.approveSubscription({
				indexId: GOODPOOL_IDA_INDEX,
				publisher: GOODPOOL_SMART_CONTRACT,
				userData: "0x"
			});
	
			const txnResponse = await approve.exec(superSigner);
			
			const txnReceipt = await txnResponse.wait();

			if (txnReceipt.status === 1) {
				console.log("Transaction succeeded!");
				toast.success("Contract Approved", {position: toast.POSITION.BOTTOM_RIGHT})
				setSuccessModal(true)
				setIsContractLoading(false)
			} else {
				setIsContractLoading(false)
				toast.error("Failed to Approve Contract", {position: toast.POSITION.BOTTOM_RIGHT})
				console.log("Transaction failed!");
			}
		} catch (err) {
			setIsContractLoading(false)
			toast.error("Failed to Approve Contract", {position: toast.POSITION.BOTTOM_RIGHT})
			console.log("FAILED TO APPROVE CONTRACT", err)
		}
	}

	const approveTokenContract = async() => {

		//console.log(address)

		const amountInWei = ethers.utils.parseEther("100000000000");

		try {
			setIsTokenLoading(true)
			// Calling the approve function sends the transaction
			const txnResponse = await tokenContractInstance.approve(
				GOODPOOL_SMART_CONTRACT,
				amountInWei
			);

			// Wait for the transaction to be mined
			const txnReceipt = await txnResponse.wait();

			if (txnReceipt.status === 1) {
				console.log("Transaction succeeded!");
				toast.success("Token Approved", {position: toast.POSITION.BOTTOM_RIGHT})
				setHasApprovedToken(true);
				setIsTokenLoading(false);
			} else {
				setIsTokenLoading(false);
				toast.error("Failed to Approve Token", {position: toast.POSITION.BOTTOM_RIGHT})
				console.log("Transaction failed!");
			}
		} catch (err) {
			setIsTokenLoading(false);
			toast.error("Failed to Approve Token", {position: toast.POSITION.BOTTOM_RIGHT})
			console.log("FAILED TO APPROVE TOKEN CONTRACT", err);
		}
	}

  const handleClose = () => {
    setDisplayApprovalModal(false);
  }

  const test = () => {
	console.log(hasApprovedToken)
	console.log(hasApprovedContract)
  }

  return (
    <div className="absolute inset-0 flex items-center justify-center z-20">
      <div className="absolute inset-0 backdrop-blur opacity-100 z-10"></div>
      <div className="flex flex-col gap-4 z-30 py-12 px-8 bg-white rounded-15 flex flex-col items-center">
				{successModal ?
          <div className="flex flex-col gap-4 px-8">
            <div className="mt-4 font-bold text-medium">Account setup successfully!</div>
            <button onClick={handleClose} className="mt-4 py-2 px-6 rounded-15 border border-green text-green hover:bg-green hover:text-white transition duration-300 ease-in-out">
              Close
            </button>
          </div>
				:
					<>
						<div className="flex flex-col justify-center items-center">
							<h2 onClick={test} className="mb-4 text-lg font-bold">Approval</h2>
							<div className="flex flex-col justify-center items-center">
								<div>By approving the GoodPool contract,</div>
								<div>winnings will be sent straight to your wallet 🎉</div>
							</div>
						</div>
						
						<button 
							onClick={approveTokenContract}
							disabled={hasApprovedToken || isTokenLoading}
							className={`py-2 px-6 rounded-15 
								${hasApprovedToken ? 'bg-green text-white border-green' : 'border border-blue border-opacity-50 text-blue hover:bg-blue hover:text-white'}
								${isTokenLoading ? 'cursor-not-allowed' : 'hover:cursor-pointer'}
								transition duration-300 ease-in-out`}
						>
							{isTokenLoading ? 'Loading...' : (hasApprovedToken ? 'Token Approved' : 'Approve Token')}
						</button>
						
						<button 
							onClick={approveContract}
							disabled={!hasApprovedToken || hasApprovedContract || isContractLoading}
							className={`py-2 px-6 rounded-15 
								${hasApprovedContract ? 'bg-green text-white border-green' : 'border border-blue border-opacity-50 text-blue'}
								${isContractLoading || !hasApprovedToken || hasApprovedContract ? 'cursor-not-allowed opacity-50' : 'hover:bg-blue hover:text-white hover:cursor-pointer'}
								transition duration-300 ease-in-out`}
							>
							{isContractLoading ? 'Loading...' : (hasApprovedContract ? 'Contract Approved' : 'Approve Contract')}
						</button>
					</>
				}
      </div>
    </div>
  );

};
