export const PUMP_PROGRAM_ID = "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P";

export const IDL = {
    "version": "0.1.0",
    "name": "pump",
    "instructions": [
        {
            "name": "create",
            "accounts": [
                { "name": "mint", "isMut": true, "isSigner": true },
                { "name": "mintAuthority", "isMut": false, "isSigner": false },
                { "name": "bondingCurve", "isMut": true, "isSigner": false },
                { "name": "associatedBondingCurve", "isMut": true, "isSigner": false },
                { "name": "global", "isMut": false, "isSigner": false },
                { "name": "mplTokenMetadata", "isMut": false, "isSigner": false },
                { "name": "metadata", "isMut": true, "isSigner": false },
                { "name": "user", "isMut": true, "isSigner": true },
                { "name": "systemProgram", "isMut": false, "isSigner": false },
                { "name": "tokenProgram", "isMut": false, "isSigner": false },
                { "name": "associatedTokenProgram", "isMut": false, "isSigner": false },
                { "name": "rent", "isMut": false, "isSigner": false },
                { "name": "eventAuthority", "isMut": false, "isSigner": false },
                { "name": "program", "isMut": false, "isSigner": false }
            ],
            "args": [
                { "name": "name", "type": "string" },
                { "name": "symbol", "type": "string" },
                { "name": "uri", "type": "string" }
            ]
        },
        {
            "name": "buy",
            "accounts": [
                { "name": "global", "isMut": false, "isSigner": false },
                { "name": "feeRecipient", "isMut": true, "isSigner": false },
                { "name": "mint", "isMut": false, "isSigner": false },
                { "name": "bondingCurve", "isMut": true, "isSigner": false },
                { "name": "associatedBondingCurve", "isMut": true, "isSigner": false },
                { "name": "associatedUser", "isMut": true, "isSigner": false },
                { "name": "user", "isMut": true, "isSigner": true },
                { "name": "systemProgram", "isMut": false, "isSigner": false },
                { "name": "tokenProgram", "isMut": false, "isSigner": false },
                { "name": "rent", "isMut": false, "isSigner": false },
                { "name": "eventAuthority", "isMut": false, "isSigner": false },
                { "name": "program", "isMut": false, "isSigner": false }
            ],
            "args": [
                { "name": "amount", "type": "u64" },
                { "name": "maxSolCost", "type": "u64" }
            ]
        },
        {
            "name": "sell",
            "accounts": [
                { "name": "global", "isMut": false, "isSigner": false },
                { "name": "feeRecipient", "isMut": true, "isSigner": false },
                { "name": "mint", "isMut": false, "isSigner": false },
                { "name": "bondingCurve", "isMut": true, "isSigner": false },
                { "name": "associatedBondingCurve", "isMut": true, "isSigner": false },
                { "name": "associatedUser", "isMut": true, "isSigner": false },
                { "name": "user", "isMut": true, "isSigner": true },
                { "name": "systemProgram", "isMut": false, "isSigner": false },
                { "name": "associatedTokenProgram", "isMut": false, "isSigner": false },
                { "name": "tokenProgram", "isMut": false, "isSigner": false },
                { "name": "eventAuthority", "isMut": false, "isSigner": false },
                { "name": "program", "isMut": false, "isSigner": false }
            ],
            "args": [
                { "name": "amount", "type": "u64" },
                { "name": "minSolOutput", "type": "u64" }
            ]
        }
    ],
    "accounts": [
        {
            "name": "Global",
            "type": {
                "kind": "struct",
                "fields": [
                    { "name": "initialized", "type": "bool" },
                    { "name": "authority", "type": "publicKey" },
                    { "name": "feeRecipient", "type": "publicKey" },
                    { "name": "initialVirtualTokenReserves", "type": "u64" },
                    { "name": "initialVirtualSolReserves", "type": "u64" },
                    { "name": "initialRealTokenReserves", "type": "u64" },
                    { "name": "tokenTotalSupply", "type": "u64" },
                    { "name": "feeBasisPoints", "type": "u64" }
                ]
            }
        },
        {
            "name": "BondingCurve",
            "type": {
                "kind": "struct",
                "fields": [
                    { "name": "virtualTokenReserves", "type": "u64" },
                    { "name": "virtualSolReserves", "type": "u64" },
                    { "name": "realTokenReserves", "type": "u64" },
                    { "name": "realSolReserves", "type": "u64" },
                    { "name": "tokenTotalSupply", "type": "u64" },
                    { "name": "complete", "type": "bool" }
                ]
            }
        }
    ]
};
