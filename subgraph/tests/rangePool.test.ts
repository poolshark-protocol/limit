import { ZERO_ADDRESS } from '../src/constants/arbitrum'
import { safeLoadLimitPoolFactory } from '../src/mappings/utils/loads'
import { createLimitPool } from './utils/pools'
import { Address, ethereum, BigInt } from '@graphprotocol/graph-ts'
import {
    assert,
    createMockedFunction,
    logStore,
    log,
    clearStore,
    test,
} from 'matchstick-as/assembly/index'

test('Limit Pool create', () => {
    clearStore()

    // Assuming these represent actual pool addresses
    const poolAddress = '0x7B47619045Ae93f9311D0562a43C244c42bfE485'
    const poolTokenAddress = '0x7B47619045Ae93f9311D0562a43C244c42bfE487' // Replace with actual pool token address

    // Assuming these represent token A and token B addresses
    const tokenA = '0x7B47619045Ae93f9311D0562a43C244c42bfE480'
    const tokenB = '0x7B47619045Ae93f9311D0562a43C244c42bfE481'
    let contractAddress0 = Address.fromString(tokenA)
    let contractAddress1 = Address.fromString(tokenB)

    let functionNameSymbol = 'symbol'
    let functionSigSymbol = 'symbol():(string)'

    createMockedFunction(
        contractAddress0,
        functionNameSymbol,
        functionSigSymbol
    ).returns([ethereum.Value.fromString('WETH')])

    createMockedFunction(
        contractAddress1,
        functionNameSymbol,
        functionSigSymbol
    ).returns([ethereum.Value.fromString('DAI')])

    let functionNameName = 'name'
    let functionSigName = 'name():(string)'

    createMockedFunction(
        contractAddress0,
        functionNameName,
        functionSigName
    ).returns([ethereum.Value.fromString('weth')])
    createMockedFunction(
        contractAddress1,
        functionNameName,
        functionSigName
    ).returns([ethereum.Value.fromString('dai')])

    let functionNameDecimals = 'decimals'
    let functionSigDecimals = 'decimals():(uint8)'

    createMockedFunction(
        contractAddress0,
        functionNameDecimals,
        functionSigDecimals
    ).returns([ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(18))])
    createMockedFunction(
        contractAddress1,
        functionNameDecimals,
        functionSigDecimals
    ).returns([ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(18))])

    // Assuming these are swap fee and tick spacing values (can be BigInt or strings based on schema)
    const swapFee = BigInt.fromI32(10).toString() // Can be a string if schema expects string
    const tickSpacing = BigInt.fromI32(10).toString() // Can be a string if schema expects string
    const poolTypeId = BigInt.fromI32(10).toString() // Replace with actual pool type ID

    let pool = createLimitPool(
        poolAddress,
        poolTokenAddress,
        tokenA,
        tokenB,
        swapFee,
        tickSpacing,
        poolTypeId
    )

    // Example assertion: Verify that an entity is created in the store
    assert.entityCount('LimitPool', 1, 'A Pool entity should be created')

    // Additional checks can be added here to verify the properties of the created pool
    // e.g., assert.fieldEquals('Pool', 'id', 'expected_id', 'The pool ID should match the expected value')
})
