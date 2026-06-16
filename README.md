# Pharos DAO Voting Interaction Skill

AI-agent skill for interacting with DAO governance contracts on Pharos-compatible EVM networks.

It lets an agent inspect proposals, check voting power, cast votes, create Governor-compatible proposals, and queue or execute successful proposals. It is designed for the case where Pharos does not yet expose an official DAO voting dApp: the skill acts as a reusable governance adapter for any OpenZeppelin Governor-style DAO deployed on Pharos.

The layout follows the Pharos Skill Engine guide: `SKILL.md` is the agent entry point, `references/governor-workflow.md` holds exact command templates, parameter tables, output rules, error handling, and agent guidelines, `assets/networks.json` provides Atlantic testnet and mainnet configuration, and `scripts/dao-vote.ts` wraps common `cast` calls into deterministic commands.

## What It Does

- Read Governor metadata and proposal state.
- Inspect vote counts, quorum, deadlines, snapshots, and voter status.
- Check voting power through `getVotes(address, blockNumber)` or `balanceOf(address)` fallback.
- Cast `against`, `for`, or `abstain` votes.
- Create proposals with `propose(targets, values, calldatas, description)`.
- Queue and execute passed proposals when the Governor supports timelock flow.
- Query Governor events such as `VoteCast`, `ProposalCreated`, `ProposalQueued`, and `ProposalExecuted`.
- Keep write operations explicit and private-key safe.

## Network Behavior

- Default network is Pharos Atlantic testnet.
- Mainnet is used only when explicitly requested.
- Every read and write command passes `--rpc-url` explicitly.
- Every write command passes `--private-key $PRIVATE_KEY` explicitly; Foundry does not auto-read the key from the environment.
- Before writes, the script derives the signer, prints network/governor/action, checks native gas balance, and blocks mainnet unless `PHAROS_DAO_CONFIRM_MAINNET=YES` is set after explicit confirmation.

## Why It Matters

DAO voting is a common AI-agent governance action even when a chain does not yet have one official DAO interface. This skill gives Pharos agents a ready path to interact with governance contracts directly through EVM primitives.

Suggested submit wording:

```text
This skill enables AI agents to interact with DAO governance contracts on Pharos-compatible EVM networks: discover proposals, check wallet voting power, cast votes, and optionally create/execute proposals using Governor-compatible ABIs.
```

## Repository Layout

```text
.
|-- SKILL.md
|-- README.md
|-- agents/openai.yaml
|-- assets/
|   |-- governor-standard-abi.json
|   |-- networks.json
|   `-- example-proposal.json
|-- references/governor-workflow.md
`-- scripts/dao-vote.ts
```

## Requirements

- Node.js 18+
- Foundry `cast`
- `PRIVATE_KEY` only for write commands
- Every write command passes `--private-key $PRIVATE_KEY` explicitly and every EVM call passes `--rpc-url` explicitly.

Install local TypeScript runner dependencies:

```bash
npm install
```

## Usage

Inspect a proposal on Atlantic testnet:

```bash
npm run dao -- inspect --network atlantic-testnet --governor 0xGovernor --proposal-id 123 --voter 0xVoter
```

Check voting power:

```bash
npm run dao -- power --network atlantic-testnet --governor 0xGovernor --voter 0xVoter --block 456
```

Cast a vote:

```bash
$env:PRIVATE_KEY="0x..."
npm run dao -- vote --network atlantic-testnet --governor 0xGovernor --proposal-id 123 --support for
```

Create a proposal:

```bash
npm run dao -- propose --network atlantic-testnet --governor 0xGovernor --targets 0xTarget --values 0 --calldatas 0x --description "Update treasury policy"
```

Queue or execute a proposal:

```bash
npm run dao -- queue --network atlantic-testnet --governor 0xGovernor --targets 0xTarget --values 0 --calldatas 0x --description "Update treasury policy"
npm run dao -- execute --network atlantic-testnet --governor 0xGovernor --targets 0xTarget --values 0 --calldatas 0x --description "Update treasury policy"
```

Query Governor events:

```bash
npm run dao -- logs --network atlantic-testnet --governor 0xGovernor --event voteCast --from-block 0
```

Supported event names:

- `proposalCreated`
- `voteCast`
- `voteCastWithParams`
- `proposalQueued`
- `proposalExecuted`
- `proposalCanceled`

## Demo Strategy

For a campaign demo, deploy a simple ERC20Votes token and OpenZeppelin Governor to Pharos Atlantic testnet from `../pharos-dao-demo-foundry`, then run:

1. `propose`
2. `inspect`
3. `power`
4. `vote`
5. `inspect`
6. `queue` / `execute`

This proves the skill even before an official Pharos DAO voting dApp exists.

Mainnet is supported only when explicitly requested. Before any mainnet write, show the target network and require explicit confirmation.

Before any write operation, the agent must confirm `PRIVATE_KEY` is set without printing it, derive the signer with `cast wallet address --private-key`, display network/governor/action, check native gas balance, and only then send the transaction. For demo verification, wait at least 10 seconds before `forge verify-contract`.

## Safety

Read operations (`inspect`, `power`, `logs`) never require a private key. Write operations (`vote`, `propose`, `queue`, `execute`) require explicit user intent, configured `PRIVATE_KEY`, gas balance, and mainnet confirmation when applicable.
