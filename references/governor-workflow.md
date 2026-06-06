# Governor Workflow Reference

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

## Write Operation Checks

Before `vote`, `propose`, `queue`, or `execute`:

1. Confirm `PRIVATE_KEY` is set without printing it.
2. Derive the signer address with `cast wallet address --private-key`.
3. Display network name, chain id, governor address, and action.
4. On mainnet, require explicit user confirmation before proceeding.
5. Send with `cast send`.

## Common Failure Handling

- `execution reverted`: proposal may be inactive, voter may be ineligible, proposal may already be voted, or quorum/deadline conditions may not be satisfied.
- `no code`: governor address is wrong or not deployed on this network.
- `function selector was not recognized`: the target Governor does not implement that optional function.
- `insufficient funds`: signer needs native gas token on the selected Pharos network.
