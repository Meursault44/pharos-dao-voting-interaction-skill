---
name: pharos-dao-voting-interaction-skill
description: Interact with DAO governance contracts on Pharos-compatible EVM networks. Use when a user or AI agent needs to discover or inspect DAO proposals, check wallet voting power, cast yes/no/abstain votes, create Governor-compatible proposals, queue or execute passed proposals, or generate safe governance transaction commands for Pharos Atlantic testnet or Pharos mainnet.
---

# Pharos DAO Voting Interaction Skill

Use this skill to help AI agents interact with DAO governance contracts on Pharos. The default target is OpenZeppelin Governor-compatible contracts, but the workflow also supports simple custom DAO contracts when the caller supplies compatible ABI/function names.

This skill follows the Pharos Skill Engine guide: `SKILL.md` is the agent entry point, the Capability Index routes user intents to detailed reference sections, `assets/networks.json` is the network source of truth, and `references/governor-workflow.md` contains command templates, parameter tables, output parsing, error handling, and agent guidelines.

## Prerequisites

- Foundry `cast` must be installed and available.
- Node.js 18+ is required for `scripts/dao-vote.ts`.
- For write operations, `PRIVATE_KEY` must be configured in the shell but never printed or committed.
- Load the base `pharos-skill-engine` before selecting network settings or building commands.
- Foundry does not auto-read private keys from the environment; every generated `cast send` / `forge script` write command must pass the key explicitly through `--private-key $PRIVATE_KEY`.

## Network Rules

- Default to Pharos Atlantic testnet unless the user explicitly asks for mainnet.
- Read network settings from `assets/networks.json`.
- Always pass `--rpc-url <rpc>` explicitly to `cast` and `forge`; never rely on a local default node.
- For write operations, require `PRIVATE_KEY` and never print it.
- Before write operations, derive the signer address, show network/governor/action, check signer native gas balance, and only then send.
- Before any write on mainnet, clearly warn the user and request confirmation.
- Use Foundry `cast` for EVM calls and transactions.

## Capability Index

| User need | Capability | Detailed instructions |
|---|---|---|
| Inspect DAO proposal, check proposal state, show votes | `cast call` Governor proposal read methods | `references/governor-workflow.md#inspect-proposal` |
| Check voting power, can this wallet vote | `cast call getVotes` with `balanceOf` fallback | `references/governor-workflow.md#check-voting-power` |
| Vote yes/no/abstain, cast DAO vote | `cast send castVote(uint256,uint8)` | `references/governor-workflow.md#cast-vote` |
| Create DAO proposal, propose action | `cast send propose(address[],uint256[],bytes[],string)` | `references/governor-workflow.md#create-proposal` |
| Queue or execute passed proposal | `cast send queue/execute` with description hash | `references/governor-workflow.md#queue-or-execute` |
| Query DAO events, vote logs, proposal logs | `cast logs` for Governor events | `references/governor-workflow.md#query-governor-events` |
| Deploy demo DAO for the skill | `forge script DeployPharosDao` in `../pharos-dao-demo-foundry` | `references/governor-workflow.md#demo-deployment` |
| Troubleshoot DAO errors | Revert/no-code/funds/nonce/network handling | `references/governor-workflow.md#common-failure-handling` |

## Core Workflow

1. Identify the governor contract address and network.
2. For proposal inspection, call `state`, `proposalSnapshot`, `proposalDeadline`, `proposalVotes`, `quorum`, and `hasVoted` when available.
3. For voting power, prefer `getVotes(address, blockNumber)` on the Governor or token. Fall back to `balanceOf(address)` only when snapshot votes are unavailable.
4. For voting, map choices to OpenZeppelin support values:
   - `against` = `0`
   - `for` = `1`
   - `abstain` = `2`
5. For proposal creation, require targets, values, calldatas, and description.
6. For execution, require the same proposal payload plus the description hash when using OpenZeppelin Governor.

## Script

Use `scripts/dao-vote.ts` for deterministic command generation and common Governor calls.

Common examples:

```bash
npm run dao -- inspect --network atlantic-testnet --governor 0xGovernor --proposal-id 123 --voter 0xVoter
npm run dao -- power --network atlantic-testnet --governor 0xGovernor --voter 0xVoter --block 456
npm run dao -- vote --network atlantic-testnet --governor 0xGovernor --proposal-id 123 --support for
npm run dao -- propose --network atlantic-testnet --governor 0xGovernor --targets 0xTarget --values 0 --calldatas 0x --description "Update treasury policy"
npm run dao -- execute --network atlantic-testnet --governor 0xGovernor --targets 0xTarget --values 0 --calldatas 0x --description "Update treasury policy"
npm run dao -- logs --network atlantic-testnet --governor 0xGovernor --event voteCast --from-block 0
```

## Optional Demo Path

If Pharos does not have an official DAO voting dApp, position this skill as infrastructure for any Governor-compatible DAO on Pharos. For a campaign demo, deploy a minimal ERC20Votes token plus OpenZeppelin Governor on Pharos Atlantic testnet, then show:

```text
create proposal -> inspect status -> check voting power -> cast vote -> inspect result -> queue/execute when eligible
```

Use the repository-level `../pharos-dao-demo-foundry` project for this demo. Its default deploy path must target Pharos Atlantic testnet (`chainId 688689`) with `RPC_URL=https://atlantic.dplabs-internal.com`. Mainnet deployment is allowed only when explicitly requested and confirmed.

For verification after demo deployment, wait at least 10 seconds before `forge verify-contract` so the explorer indexer can see the new contract.

Load `references/governor-workflow.md` for detailed command behavior and edge cases.
