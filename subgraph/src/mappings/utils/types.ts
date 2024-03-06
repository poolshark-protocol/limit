import { BigInt } from '@graphprotocol/graph-ts'

export class SeasonReward {
    WHITELISTED_PAIRS: string[];
    BLACKLISTED_ADDRESSES: string[];
    START_TIME: BigInt;
    END_TIME: BigInt;
}