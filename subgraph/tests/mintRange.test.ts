import { handleMintLimit } from '../src/mappings/limitpool'
import { createMintRange } from './utils/mintRange'
import { Address, ethereum, BigInt } from '@graphprotocol/graph-ts'
import {
    assert,
    createMockedFunction,
    logStore,
    log,
    clearStore,
    test,
} from 'matchstick-as/assembly/index'

test('Mint Range Test', () => {
    clearStore()

    let recipient = '0x7B47619045Ae93f9311D0562a43C244c42bfE485'
    let lower = '0'
    let upper = '100'
    let positionId = '1'
    let liquidityMinted = '100'
    let amount0Delta = '100'
    let amount1Delta = '100'

    let mintRange = createMintRange(
        recipient,
        lower,
        upper,
        positionId,
        liquidityMinted,
        amount0Delta,
        amount1Delta
    )

    assert.entityCount('MintRange', 1)
})
