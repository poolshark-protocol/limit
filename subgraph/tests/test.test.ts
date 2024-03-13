import { ZERO_ADDRESS } from '../src/constants/arbitrum'
import { safeLoadLimitPoolFactory } from '../src/mappings/utils/loads'
import { createLimitPoolCreated } from './utils/pools'
import { Address, ethereum, BigInt } from '@graphprotocol/graph-ts'
import {
    assert,
    createMockedFunction,
    logStore,
    log,
    clearStore,
    test,
} from 'matchstick-as/assembly/index'

test('Pool create', () => {
    clearStore()

    // Assuming these represent actual pool addresses
    const poolAddress = '0x7B47619045Ae93f9311D0562a43C244c42bfE485'
    const poolTokenAddress = '0x7B47619045Ae93f9311D0562a43C244c42bfE485' // Replace with actual pool token address

    // Assuming these represent token A and token B addresses
    const tokenA = ZERO_ADDRESS.toString()
    const tokenB = ZERO_ADDRESS.toString()

    // Assuming these are swap fee and tick spacing values (can be BigInt or strings based on schema)
    const swapFee = BigInt.fromI32(10).toString() // Can be a string if schema expects string
    const tickSpacing = BigInt.fromI32(10).toString() // Can be a string if schema expects string
    const poolTypeId = BigInt.fromI32(10).toString() // Replace with actual pool type ID

    let pool = createLimitPoolCreated(
        poolAddress,
        poolTokenAddress,
        tokenA,
        tokenB,
        swapFee,
        tickSpacing,
        poolTypeId
    )

    // Example assertion: Verify that an entity is created in the store
    assert.entityCount('Pool', 1, 'A Pool entity should be created')

    // Additional checks can be added here to verify the properties of the created pool
    // e.g., assert.fieldEquals('Pool', 'id', 'expected_id', 'The pool ID should match the expected value')
})
