export function getUserDataKey(fid: number) {
  return `farcaster:user:${fid}`;
}

export function getMutualsKey(fid: number) {
  return `farcaster:mutuals:${fid}`;
}
