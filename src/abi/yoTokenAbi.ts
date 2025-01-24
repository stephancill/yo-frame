import { parseAbi } from "viem/utils";

export const yoTokenAbi = parseAbi([
  "function yoAmount() external view returns (uint256)",
  "function balanceOf(address account) external view returns (uint256)",
  "function batchYo(address[] calldata tos, bytes[] calldata datas) public",
  "event YoEvent(address indexed from, address indexed to, uint256 indexed amount, bytes data)",
]);
