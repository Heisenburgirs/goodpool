import { BigNumberish, ethers } from 'ethers';

export function toHumanReadable(value: BigNumberish, decimals = 18) {
    return ethers.utils.formatUnits(value, decimals);
}

export function fromWeiToEther(weiValueStr: string) {
    const weiValueNum = BigInt(weiValueStr);
    const etherValueNum = Number(weiValueNum / BigInt(10**18));
    return etherValueNum;
}