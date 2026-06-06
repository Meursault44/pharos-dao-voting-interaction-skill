# Pharos DAO Voting Interaction Skill

AI-agent skill for interacting with DAO governance contracts on Pharos-compatible EVM networks.

It lets an agent inspect proposals, check voting power, cast votes, create Governor-compatible proposals, and queue or execute successful proposals. It is designed for the case where Pharos does not yet expose an official DAO voting dApp: the skill acts as a reusable governance adapter for any OpenZeppelin Governor-style DAO deployed on Pharos.

## What It Does

- Read Governor metadata and proposal state.
- Inspect vote counts, quorum, deadlines, snapshots, and voter status.
- Check voting power through `getVotes(address, blockNumber)` or `balanceOf(address)` fallback.
- Cast `against`, `for`, or `abstain` votes.
- Create proposals with `propose(targets, values, calldatas, description)`.
- Queue and execute passed proposals when the Governor supports timelock flow.
- Keep write operations explicit and private-key safe.

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

Install local TypeScript runner dependencies:

```bash
npm install
```

## Usage

Inspect a proposal:

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

## Demo Strategy

For a campaign demo, deploy a simple ERC20Votes token and OpenZeppelin Governor to Pharos Atlantic testnet, then run:

1. `propose`
2. `inspect`
3. `power`
4. `vote`
5. `inspect`
6. `queue` / `execute`

This proves the skill even before an official Pharos DAO voting dApp exists.
