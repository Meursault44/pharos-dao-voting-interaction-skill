---
name: pharos-dao-voting-interaction-skill
description: Interact with DAO governance contracts on Pharos-compatible EVM networks. Use when a user or AI agent needs to discover or inspect DAO proposals, check wallet voting power, cast yes/no/abstain votes, create Governor-compatible proposals, queue or execute passed proposals, or generate safe governance transaction commands for Pharos Atlantic testnet or Pharos mainnet.
---

# Pharos DAO Voting Interaction Skill

Use this skill to help AI agents interact with DAO governance contracts on Pharos. The default target is OpenZeppelin Governor-compatible contracts, but the workflow also supports simple custom DAO contracts when the caller supplies compatible ABI/function names.

## Network Rules

- Default to Pharos mainnet unless the user explicitly asks for Atlantic testnet.
- Read network settings from `assets/networks.json`.
- For write operations, require `PRIVATE_KEY` and never print it.
- Before any write on mainnet, clearly warn the user and request confirmation.
- Use Foundry `cast` for EVM calls and transactions.

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
npm run dao -- inspect --network mainnet --governor 0xGovernor --proposal-id 123 --voter 0xVoter
npm run dao -- power --network mainnet --governor 0xGovernor --voter 0xVoter --block 456
npm run dao -- vote --network mainnet --governor 0xGovernor --proposal-id 123 --support for
npm run dao -- propose --network mainnet --governor 0xGovernor --targets 0xTarget --values 0 --calldatas 0x --description "Update treasury policy"
npm run dao -- execute --network mainnet --governor 0xGovernor --targets 0xTarget --values 0 --calldatas 0x --description "Update treasury policy"
```

## Optional Demo Path

If Pharos does not have an official DAO voting dApp, position this skill as infrastructure for any Governor-compatible DAO on Pharos. For a campaign demo, deploy a minimal ERC20Votes token plus OpenZeppelin Governor on Pharos mainnet or Atlantic testnet, then show:

```text
create proposal -> inspect status -> check voting power -> cast vote -> inspect result -> queue/execute when eligible
```

Load `references/governor-workflow.md` for detailed command behavior and edge cases.
