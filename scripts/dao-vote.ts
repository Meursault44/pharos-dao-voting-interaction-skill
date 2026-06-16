#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

type Network = {
  name: string;
  rpcUrl: string;
  chainId: number;
  explorerUrl: string;
  nativeToken: string;
};

type NetworkConfig = {
  networks: Network[];
  defaultNetwork: string;
};

type Args = Record<string, string | boolean>;

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const configPath = join(root, "assets", "networks.json");
const states = ["Pending", "Active", "Canceled", "Defeated", "Succeeded", "Queued", "Expired", "Executed"];
const castBin = resolveCastBin();
const supportValues: Record<string, string> = {
  against: "0",
  no: "0",
  for: "1",
  yes: "1",
  abstain: "2"
};
const governorEvents: Record<string, string> = {
  proposalCreated: "ProposalCreated(uint256,address,address[],uint256[],string[],bytes[],uint256,uint256,string)",
  voteCast: "VoteCast(address,uint256,uint8,uint256,string)",
  voteCastWithParams: "VoteCastWithParams(address,uint256,uint8,uint256,string,bytes)",
  proposalQueued: "ProposalQueued(uint256,uint256)",
  proposalExecuted: "ProposalExecuted(uint256)",
  proposalCanceled: "ProposalCanceled(uint256)"
};

function usage(exitCode = 0): never {
  const text = `
Pharos DAO Voting Interaction

Usage:
  dao-vote inspect --governor 0x... --proposal-id 123 [--voter 0x...] [--network atlantic-testnet]
  dao-vote power --governor 0x... --voter 0x... --block 456 [--token 0x...]
  dao-vote vote --governor 0x... --proposal-id 123 --support for|against|abstain
  dao-vote propose --governor 0x... --targets 0xA,0xB --values 0,0 --calldatas 0x,0x --description "..."
  dao-vote queue --governor 0x... --targets 0xA --values 0 --calldatas 0x --description "..."
  dao-vote execute --governor 0x... --targets 0xA --values 0 --calldatas 0x --description "..."
  dao-vote logs --governor 0x... --event voteCast --from-block 0
`;
  console.log(text.trim());
  process.exit(exitCode);
}

function resolveCastBin(): string {
  if (process.env.CAST_BIN) return process.env.CAST_BIN;
  const candidates = [
    join(homedir(), ".foundry", "bin", process.platform === "win32" ? "cast.exe" : "cast"),
    join("D:", "Users", "gamea", ".foundry", "bin", "cast.exe")
  ];
  return candidates.find((candidate) => existsSync(candidate)) ?? "cast";
}

function parse(argv: string[]): { command: string; args: Args } {
  const [command, ...rest] = argv;
  if (!command || command === "help" || command === "--help") usage();
  const args: Args = {};
  for (let i = 0; i < rest.length; i += 1) {
    const item = rest[i];
    if (!item.startsWith("--")) throw new Error(`Unexpected argument: ${item}`);
    const key = item.slice(2);
    const next = rest[i + 1];
    if (!next || next.startsWith("--")) {
      args[key] = true;
    } else {
      args[key] = next;
      i += 1;
    }
  }
  return { command, args };
}

function required(args: Args, key: string): string {
  const value = args[key];
  if (typeof value !== "string" || value.length === 0) throw new Error(`Missing --${key}`);
  return value;
}

function optional(args: Args, key: string): string | undefined {
  const value = args[key];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function readNetworks(): NetworkConfig {
  if (!existsSync(configPath)) throw new Error(`Missing ${configPath}`);
  return JSON.parse(readFileSync(configPath, "utf8")) as NetworkConfig;
}

function resolveNetwork(args: Args): Network {
  const config = readNetworks();
  const name = optional(args, "network") ?? config.defaultNetwork;
  const network = config.networks.find((item) => item.name === name);
  if (!network) throw new Error(`Unsupported network "${name}". Use: ${config.networks.map((item) => item.name).join(", ")}`);
  return network;
}

function run(command: string, args: string[], options: { allowFailure?: boolean; redact?: boolean } = {}): string {
  const rendered = `${command} ${args.map((arg) => (options.redact && arg === process.env.PRIVATE_KEY ? "<PRIVATE_KEY>" : arg)).join(" ")}`;
  const result = spawnSync(command, args, { encoding: "utf8", shell: false });
  if (result.status !== 0) {
    if (options.allowFailure) return "";
    const stderr = result.stderr.trim();
    throw new Error(`Command failed: ${rendered}\n${stderr || result.stdout.trim()}`);
  }
  return result.stdout.trim();
}

function cast(args: string[], allowFailure = false): string {
  return run(castBin, args, { allowFailure });
}

function castCall(network: Network, address: string, signature: string, params: string[] = [], allowFailure = true): string {
  return cast(["call", address, signature, ...params, "--rpc-url", network.rpcUrl], allowFailure);
}

function printResult(label: string, value: string): void {
  console.log(`${label}: ${value.length > 0 ? value : "unavailable"}`);
}

function formatInteger(value: string): string {
  return BigInt(value).toLocaleString("en-US");
}

function formatTokenAmount(raw: string, symbol = "PDVT"): string {
  const value = BigInt(castNumber(raw));
  const base = 10n ** 18n;
  const whole = value / base;
  const fraction = value % base;
  if (fraction === 0n) return `${formatInteger(whole.toString())} ${symbol}`;
  const fractionText = fraction.toString().padStart(18, "0").replace(/0+$/, "");
  return `${formatInteger(whole.toString())}.${fractionText} ${symbol}`;
}

function printTokenResult(label: string, value: string, symbol = "PDVT"): void {
  console.log(`${label}: ${value.length > 0 ? formatTokenAmount(value, symbol) : "unavailable"}`);
}

function printProposalVotes(value: string): void {
  const values = value.split(/\s+/).filter((item) => /^\d+$/.test(item));
  if (values.length < 3) {
    printResult("Votes", value);
    return;
  }
  printTokenResult("Against votes", values[0]);
  printTokenResult("For votes", values[1]);
  printTokenResult("Abstain votes", values[2]);
}

function splitCsv(value: string): string[] {
  return value.split(",").map((item) => item.trim()).filter(Boolean);
}

function arrayArg(items: string[]): string {
  return `[${items.join(",")}]`;
}

function descriptionHash(description: string): string {
  return cast(["keccak", description], false);
}

function castNumber(value: string): string {
  return value.split(/\s+/)[0] ?? value;
}

function requirePrivateKey(network: Network, governor: string, action: string): string {
  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey) throw new Error("PRIVATE_KEY is not set. Set it before write operations.");
  const signer = run(castBin, ["wallet", "address", "--private-key", privateKey], { redact: true });
  console.log(`Signer: ${signer}`);
  console.log(`Network: ${network.name} (chain ${network.chainId})`);
  console.log(`Governor: ${governor}`);
  console.log(`Action: ${action}`);
  if (network.name === "mainnet" && process.env.PHAROS_DAO_CONFIRM_MAINNET !== "YES") {
    throw new Error("Mainnet write blocked. Set PHAROS_DAO_CONFIRM_MAINNET=YES only after explicit user confirmation.");
  }
  const balance = run(castBin, ["balance", signer, "--rpc-url", network.rpcUrl, "--ether"], { redact: true });
  console.log(`Signer native balance: ${balance} ${network.nativeToken}`);
  return privateKey;
}

function sendGovernor(network: Network, governor: string, signature: string, params: string[], action: string): void {
  const privateKey = requirePrivateKey(network, governor, action);
  const output = run(castBin, ["send", governor, signature, ...params, "--rpc-url", network.rpcUrl, "--private-key", privateKey], { redact: true });
  console.log(output);
}

function inspect(args: Args): void {
  const network = resolveNetwork(args);
  const governor = required(args, "governor");
  const proposalId = required(args, "proposal-id");
  console.log(`Network: ${network.name} (chain ${network.chainId})`);
  printResult("Governor name", castCall(network, governor, "name()(string)"));
  printResult("Governor version", castCall(network, governor, "version()(string)"));
  const stateRaw = castCall(network, governor, "state(uint256)(uint8)", [proposalId]);
  const stateNumber = Number(castNumber(stateRaw));
  printResult("Proposal state", Number.isFinite(stateNumber) ? `${stateRaw} (${states[stateNumber] ?? "Unknown"})` : stateRaw);
  const snapshot = castCall(network, governor, "proposalSnapshot(uint256)(uint256)", [proposalId]);
  printResult("Snapshot block", snapshot);
  printResult("Deadline block", castCall(network, governor, "proposalDeadline(uint256)(uint256)", [proposalId]));
  printProposalVotes(castCall(network, governor, "proposalVotes(uint256)(uint256,uint256,uint256)", [proposalId]));
  if (snapshot) printTokenResult("Quorum at snapshot", castCall(network, governor, "quorum(uint256)(uint256)", [castNumber(snapshot)]));
  const voter = optional(args, "voter");
  if (voter) {
    printResult("Voter has voted", castCall(network, governor, "hasVoted(uint256,address)(bool)", [proposalId, voter]));
    checkPower(network, governor, voter, optional(args, "token"), optional(args, "block") ?? castNumber(snapshot));
  }
}

function checkPower(network: Network, governor: string, voter: string, token?: string, block?: string): void {
  const blockNumber = block || "latest";
  if (blockNumber !== "latest") {
    const governorVotes = castCall(network, governor, "getVotes(address,uint256)(uint256)", [voter, blockNumber]);
    if (governorVotes) {
      printTokenResult("Voting power", governorVotes);
      return;
    }
  }
  if (token && blockNumber !== "latest") {
    const tokenVotes = castCall(network, token, "getVotes(address,uint256)(uint256)", [voter, blockNumber]);
    if (tokenVotes) {
      printTokenResult("Token voting power", tokenVotes);
      return;
    }
  }
  if (token) {
    printTokenResult("Current token balance fallback", castCall(network, token, "balanceOf(address)(uint256)", [voter]));
    console.log("Note: balanceOf is not snapshot-accurate voting power.");
    return;
  }
  printResult("Voting power", "");
}

function power(args: Args): void {
  const network = resolveNetwork(args);
  checkPower(network, required(args, "governor"), required(args, "voter"), optional(args, "token"), optional(args, "block"));
}

function vote(args: Args): void {
  const network = resolveNetwork(args);
  const governor = required(args, "governor");
  const support = supportValues[required(args, "support").toLowerCase()];
  if (!support) throw new Error("Unsupported --support. Use for, against, or abstain.");
  sendGovernor(network, governor, "castVote(uint256,uint8)", [required(args, "proposal-id"), support], `cast vote (${support})`);
}

function proposalPayload(args: Args): { targets: string[]; values: string[]; calldatas: string[]; description: string; hash: string } {
  const targets = splitCsv(required(args, "targets"));
  const values = splitCsv(required(args, "values"));
  const calldatas = splitCsv(required(args, "calldatas"));
  if (targets.length !== values.length || targets.length !== calldatas.length) {
    throw new Error("--targets, --values, and --calldatas must have equal item counts");
  }
  const description = required(args, "description");
  return { targets, values, calldatas, description, hash: descriptionHash(description) };
}

function propose(args: Args): void {
  const network = resolveNetwork(args);
  const governor = required(args, "governor");
  const payload = proposalPayload(args);
  sendGovernor(
    network,
    governor,
    "propose(address[],uint256[],bytes[],string)",
    [arrayArg(payload.targets), arrayArg(payload.values), arrayArg(payload.calldatas), payload.description],
    "create proposal"
  );
}

function queueOrExecute(command: "queue" | "execute", args: Args): void {
  const network = resolveNetwork(args);
  const governor = required(args, "governor");
  const payload = proposalPayload(args);
  printResult("Description hash", payload.hash);
  sendGovernor(
    network,
    governor,
    `${command}(address[],uint256[],bytes[],bytes32)`,
    [arrayArg(payload.targets), arrayArg(payload.values), arrayArg(payload.calldatas), payload.hash],
    command
  );
}

function logs(args: Args): void {
  const network = resolveNetwork(args);
  const governor = required(args, "governor");
  const eventName = (optional(args, "event") ?? "voteCast").replace(/[-_]/g, "").toLowerCase();
  const eventKey = Object.keys(governorEvents).find((key) => key.toLowerCase() === eventName);
  if (!eventKey) throw new Error(`Unsupported --event. Use: ${Object.keys(governorEvents).join(", ")}`);
  const fromBlock = optional(args, "from-block") ?? "0";
  const toBlock = optional(args, "to-block");
  console.log(`Network: ${network.name} (chain ${network.chainId})`);
  console.log(`Governor: ${governor}`);
  console.log(`Event: ${governorEvents[eventKey]}`);
  const castArgs = ["logs", "--from-block", fromBlock, "--address", governor, governorEvents[eventKey], "--rpc-url", network.rpcUrl];
  if (toBlock) castArgs.splice(3, 0, "--to-block", toBlock);
  console.log(run(castBin, castArgs));
}

function main(): void {
  const { command, args } = parse(process.argv.slice(2));
  if (command === "inspect") return inspect(args);
  if (command === "power") return power(args);
  if (command === "vote") return vote(args);
  if (command === "propose") return propose(args);
  if (command === "queue" || command === "execute") return queueOrExecute(command, args);
  if (command === "logs") return logs(args);
  throw new Error(`Unknown command: ${command}`);
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
