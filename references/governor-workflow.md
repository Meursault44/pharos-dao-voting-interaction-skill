# Governor Workflow Reference

> Network configuration is read from `assets/networks.json`.
> Default network is `atlantic-testnet`.
> Private keys must be passed explicitly through `PRIVATE_KEY`; never print the key.
> Every `cast` and `forge` command must include an explicit `--rpc-url`.

This reference follows the Pharos Skill Engine guide: each operation includes an overview, command template, parameter table, output parsing rules, error handling, and numbered agent guidelines.

## Contract Compatibility

The primary target is OpenZeppelin Governor with optional modules:

- `GovernorCountingSimple` for `proposalVotes`.
- `GovernorVotes` for token-backed `getVotes`.
- `GovernorTimelockControl` for `queue` and `execute`.

Some custom DAO contracts expose `proposalCount` or `proposals(id)` mappings. Treat those as optional helpers. OpenZeppelin Governor proposal ids are usually generated with `hashProposal`.

## Proposal States

OpenZeppelin Governor state values:

```text
0 Pending
1 Active
2 Canceled
3 Defeated
4 Succeeded
5 Queued
6 Expired
7 Executed
```

Only `Active` proposals can normally receive votes. Only `Succeeded` proposals can normally be queued or executed, depending on whether the Governor uses a timelock.

## Voting Support Values

```text
0 against
1 for
2 abstain
```

Agents should show the support value before sending a vote transaction.

## Voting Power

Prefer snapshot voting power:

```bash
cast call <governor-or-token> "getVotes(address,uint256)(uint256)" <voter> <snapshotBlock> --rpc-url <rpc>
```

If `getVotes` is unavailable, use current token balance only as a lower-confidence fallback:

```bash
cast call <token> "balanceOf(address)(uint256)" <voter> --rpc-url <rpc>
```

Always tell the user when a fallback is not snapshot-accurate.

## Inspect Proposal

### Overview

Read proposal metadata and state from an OpenZeppelin Governor-compatible contract.

### Command Template

```bash
npm run dao -- inspect --network atlantic-testnet --governor <governor> --proposal-id <proposalId> --voter <voter>
```

### Parameters

| Parameter | Type | Required | Description |
|---|---|---:|---|
| `--network` | string | No | `atlantic-testnet` by default, or `mainnet` only when explicitly requested. |
| `--governor` | address | Yes | Governor-compatible contract address. |
| `--proposal-id` | uint256 | Yes | Governor proposal id. |
| `--voter` | address | No | Wallet to check `hasVoted` and voting power for. |
| `--token` | address | No | Voting token address for fallback voting-power reads. |
| `--block` | uint256 | No | Snapshot block override. |

### Output Parsing

| Field | Description |
|---|---|
| `Governor name` / `version` | Contract identity, if implemented. |
| `Proposal state` | Numeric state plus decoded Governor state label. |
| `Snapshot block` | Block used for historical voting power. |
| `Deadline block` | Last block where voting can be active. |
| `Against/For/Abstain votes` | Vote totals formatted as governance-token units. |
| `Voter has voted` | Whether the supplied voter already voted. |

### Error Handling

| Error signature | Cause | Suggested action |
|---|---|---|
| Empty return value | No contract code or wrong network. | Confirm governor address and selected network. |
| `function selector was not recognized` | Optional Governor method is missing. | Continue with available fields and state that the method is unsupported. |
| `execution reverted` | Proposal id invalid or Governor rejected the read. | Confirm proposal id and Governor compatibility. |

> Agent Guidelines:
> 1. Confirm `--network` and `--governor`.
> 2. Prefer read-only calls before suggesting any vote.
> 3. Preserve unavailable optional fields instead of inventing data.
> 4. Link the explorer for the selected network when reporting a real contract.

## Check Voting Power

### Overview

Check snapshot voting power for a wallet. Use `getVotes(address,uint256)` first; use `balanceOf(address)` only as a fallback.

### Command Template

```bash
npm run dao -- power --network atlantic-testnet --governor <governor> --voter <voter> --block <snapshotBlock> --token <token>
```

### Parameters

| Parameter | Type | Required | Description |
|---|---|---:|---|
| `--governor` | address | Yes | Governor-compatible contract address. |
| `--voter` | address | Yes | Wallet address to inspect. |
| `--block` | uint256 | No | Snapshot block. Required for accurate `getVotes`. |
| `--token` | address | No | Token address for `getVotes` or `balanceOf` fallback. |

### Output Parsing

| Field | Description |
|---|---|
| `Voting power` | Snapshot voting power from Governor. |
| `Token voting power` | Snapshot voting power from token. |
| `Current token balance fallback` | Current balance, not snapshot-accurate. |

### Error Handling

| Error signature | Cause | Suggested action |
|---|---|---|
| Empty output | No compatible voting-power method. | Ask for the voting token or proposal snapshot block. |
| `invalid address` | Wallet/token/governor format is wrong. | Require `0x` plus 40 hex characters. |

> Agent Guidelines:
> 1. Prefer snapshot power over current balance.
> 2. Say clearly when output is a fallback and not snapshot-accurate.
> 3. Do not infer vote eligibility from balance alone when a snapshot exists.

## Write Operation Checks

Before `vote`, `propose`, `queue`, or `execute`:

1. Confirm `PRIVATE_KEY` is set without printing it.
2. Derive the signer address with `cast wallet address --private-key $PRIVATE_KEY`.
3. Display network name, chain id, governor address, and action.
4. Default to Atlantic testnet. On mainnet, require explicit user confirmation before proceeding.
5. Check signer native token balance with `cast balance <signer> --rpc-url <rpc> --ether`.
6. Send with `cast send ... --rpc-url <rpc> --private-key $PRIVATE_KEY`.

## Cast Vote

### Overview

Cast `against`, `for`, or `abstain` on an active Governor proposal.

### Command Template

```bash
npm run dao -- vote --network atlantic-testnet --governor <governor> --proposal-id <proposalId> --support for
```

### Parameters

| Parameter | Type | Required | Description |
|---|---|---:|---|
| `--governor` | address | Yes | Governor-compatible contract address. |
| `--proposal-id` | uint256 | Yes | Proposal id to vote on. |
| `--support` | enum | Yes | `for`, `against`, or `abstain`. Aliases: `yes`, `no`. |

### Output Parsing

| Field | Description |
|---|---|
| `Signer` | Address derived from `PRIVATE_KEY`. |
| `Network` | Selected network and chain id. |
| Cast output | Transaction hash and receipt summary from Foundry. |

### Error Handling

| Error signature | Cause | Suggested action |
|---|---|---|
| `PRIVATE_KEY is not set` | Missing key in shell. | Set `PRIVATE_KEY` in the current shell. |
| `Mainnet write blocked` | Mainnet was selected without confirmation. | Require explicit confirmation, then set `PHAROS_DAO_CONFIRM_MAINNET=YES`. |
| `execution reverted` | Proposal inactive, voter already voted, or no power. | Inspect proposal state and voter power before retrying. |
| `insufficient funds` | Signer lacks native gas. | Fund signer with PHRS on testnet or PROS on mainnet. |

> Agent Guidelines:
> 1. Complete Write Operation Checks.
> 2. Show support mapping before sending: against `0`, for `1`, abstain `2`.
> 3. Confirm proposal state is `Active` when practical.
> 4. Do not vote on mainnet without explicit user confirmation.

## Create Proposal

### Overview

Create a Governor proposal with targets, values, calldatas, and description.

### Command Template

```bash
npm run dao -- propose --network atlantic-testnet --governor <governor> --targets <targetsCsv> --values <valuesCsv> --calldatas <calldatasCsv> --description "<description>"
```

### Parameters

| Parameter | Type | Required | Description |
|---|---|---:|---|
| `--targets` | CSV address[] | Yes | Target contract addresses. |
| `--values` | CSV uint256[] | Yes | Native value per target. Use `0` for non-payable calls. |
| `--calldatas` | CSV bytes[] | Yes | Encoded call data per target. |
| `--description` | string | Yes | Human-readable proposal description. |

### Output Parsing

| Field | Description |
|---|---|
| Transaction hash | Proposal creation transaction. |
| Logs | Use receipt/logs to identify the proposal id if emitted. |

### Error Handling

| Error signature | Cause | Suggested action |
|---|---|---|
| unequal item counts | Targets, values, and calldatas arrays differ. | Make all CSV arrays the same length. |
| `execution reverted` | Proposal threshold or Governor rule not met. | Check proposer voting power and Governor settings. |

> Agent Guidelines:
> 1. Encode calldata with `cast calldata` before proposing.
> 2. Show every target/value/calldata before sending.
> 3. Use Atlantic testnet for demos unless mainnet is explicitly requested.

## Queue Or Execute

### Overview

Queue or execute a successful proposal. Uses the same payload as proposal creation plus `descriptionHash`.

### Command Template

```bash
npm run dao -- execute --network atlantic-testnet --governor <governor> --targets <targetsCsv> --values <valuesCsv> --calldatas <calldatasCsv> --description "<description>"
```

### Parameters

| Parameter | Type | Required | Description |
|---|---|---:|---|
| `queue` / `execute` | command | Yes | Selects the Governor action. |
| `--targets` | CSV address[] | Yes | Must match proposal creation. |
| `--values` | CSV uint256[] | Yes | Must match proposal creation. |
| `--calldatas` | CSV bytes[] | Yes | Must match proposal creation. |
| `--description` | string | Yes | Must match proposal creation exactly. |

### Output Parsing

| Field | Description |
|---|---|
| `Description hash` | Hash derived from the description. |
| Transaction hash | Queue/execute transaction. |

### Error Handling

| Error signature | Cause | Suggested action |
|---|---|---|
| `execution reverted` | Proposal not succeeded/queued, payload mismatch, or timelock delay. | Inspect state and verify payload equals original proposal. |
| `function selector was not recognized` | Governor has no queue/execute method. | Check whether this Governor uses a different timelock flow. |

> Agent Guidelines:
> 1. Recompute and display the description hash.
> 2. Confirm proposal state before sending.
> 3. Never change payload values between propose and execute.

## Query Governor Events

### Overview

Query Governor event logs directly from the selected Pharos network. This is read-only and useful for reconstructing proposal creation, vote casts, queue, execute, and cancellation history.

### Command Template

```bash
npm run dao -- logs --network atlantic-testnet --governor <governor> --event voteCast --from-block <block> --to-block <block>
```

Equivalent raw `cast logs` shape:

```bash
cast logs --from-block <block> --address <governor> "VoteCast(address,uint256,uint8,uint256,string)" --rpc-url <rpc>
```

### Parameters

| Parameter | Type | Required | Description |
|---|---|---:|---|
| `--network` | string | No | `atlantic-testnet` by default, or `mainnet` only when explicitly requested. |
| `--governor` | address | Yes | Governor-compatible contract address. |
| `--event` | enum | No | `proposalCreated`, `voteCast`, `voteCastWithParams`, `proposalQueued`, `proposalExecuted`, or `proposalCanceled`. Defaults to `voteCast`. |
| `--from-block` | uint256 | No | Start block. Defaults to `0`. |
| `--to-block` | uint256 | No | Optional end block. |

### Output Parsing

| Field | Description |
|---|---|
| Event signature | Confirms which Governor event was queried. |
| Log address | Governor contract address that emitted the event. |
| Topics/data | Decode with the event ABI when presenting final user-facing summaries. |

### Error Handling

| Error signature | Cause | Suggested action |
|---|---|---|
| `Unsupported --event` | Event name is not in the built-in Governor event map. | Use a supported Governor event or run raw `cast logs` with a custom signature. |
| Empty output | No matching logs in the selected range. | Narrow/expand block range or verify the governor address. |
| `invalid address` | Governor address malformed. | Require `0x` plus 40 hex characters. |

> Agent Guidelines:
> 1. Event queries are read-only and do not need `PRIVATE_KEY`.
> 2. Always include network, governor address, event name, and block range in the answer.
> 3. Do not infer proposal state from logs alone; use `inspect` for current state.

## Demo Deployment

Use `../pharos-dao-demo-foundry` for a complete demo DAO deployment. The default demo deployment target is Pharos Atlantic testnet:

```powershell
$env:PRIVATE_KEY="0xYOUR_TEST_DEPLOY_WALLET_PRIVATE_KEY"
$env:RPC_URL="https://atlantic.dplabs-internal.com"

forge script script/DeployPharosDao.s.sol:DeployPharosDao --rpc-url $env:RPC_URL --broadcast --slow
```

Use `--network atlantic-testnet` with this skill when inspecting proposals or voting on that demo DAO.

After deployment, wait at least 10 seconds before verification:

```powershell
Start-Sleep -Seconds 10
forge verify-contract <contract_address> src/<path>:<ContractName> --chain-id 688689 --verifier-url https://api.socialscan.io/pharos-atlantic-testnet/v1/explorer/command_api/contract --verifier blockscout
```

## Common Failure Handling

- `execution reverted`: proposal may be inactive, voter may be ineligible, proposal may already be voted, or quorum/deadline conditions may not be satisfied.
- `no code`: governor address is wrong or not deployed on this network.
- `function selector was not recognized`: the target Governor does not implement that optional function.
- `insufficient funds`: signer needs native gas token on the selected Pharos network.
