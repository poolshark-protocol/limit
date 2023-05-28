export const ERC20_ABI: string[] = [
    'function name() view returns (string)',
    'function symbol() view returns (string)',
    'function decimals() view returns (uint)',
    'function balanceOf(address) view returns (uint)',
    'function approve(address spender, uint256 amount)',
    'function allowance(address owner, address spender) view returns (uint256)',
    'function transfer(address to, uint amount)',
    'function transferFrom(address sender, address recipient, uint256 amount)',
    'event Transfer(address indexed from, address indexed to, uint amount)',
]

export const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

export const retryAsyncOperation = ({
    operation,
    delay = 1000,
    retries = 1,
}: {
    operation: any
    delay?: number
    retries?: number
}) =>
    new Promise((resolve, reject) => {
        return operation()
            .then(resolve)
            .catch((reason: string) => {
                if (retries > 0) {
                    return wait(delay)
                        .then(retryAsyncOperation.bind(null, operation, delay, retries - 1))
                        .then(resolve)
                        .catch(reject)
                }

                return reject(reason)
            })
    })
