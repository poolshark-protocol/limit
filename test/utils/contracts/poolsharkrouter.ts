export function getMintRangeInputData(stake: boolean): any {
    if (stake)
        return ethers.utils.defaultAbiCoder.encode(
            [
                {
                    components: [
                        {
                            internalType: "address",
                            name: "staker",
                            type: "address",
                        },
                    ],
                    name: "params",
                    type: "tuple",
                }
            ],
            [
                {
                    staker: hre.props.rangeStaker.address
                }
            ]
        )
    else
        return ethers.utils.formatBytes32String('')
}