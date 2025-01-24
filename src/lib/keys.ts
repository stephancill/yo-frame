import { getAddress } from "viem/utils";

export function getUserDataKey(fid: number) {
  return `farcaster:user:${fid}`;
}

export function getMutualsKey(fid: number) {
  return `farcaster:mutuals:${fid}`;
}

export function getUserDataByAddressKey(address: `0x${string}`) {
  return `farcaster:user:${getAddress(address)}`;
}
