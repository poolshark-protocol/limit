// THIS IS AN AUTOGENERATED FILE. DO NOT EDIT THIS FILE DIRECTLY.

import {
  ethereum,
  JSONValue,
  TypedMap,
  Entity,
  Bytes,
  Address,
  BigInt
} from "@graphprotocol/graph-ts";

export class RouterDeployed extends ethereum.Event {
  get params(): RouterDeployed__Params {
    return new RouterDeployed__Params(this);
  }
}

export class RouterDeployed__Params {
  _event: RouterDeployed;

  constructor(event: RouterDeployed) {
    this._event = event;
  }

  get router(): Address {
    return this._event.parameters[0].value.toAddress();
  }

  get limitPoolFactory(): Address {
    return this._event.parameters[1].value.toAddress();
  }

  get coverPoolFactory(): Address {
    return this._event.parameters[2].value.toAddress();
  }
}

export class PoolsharkRouter extends ethereum.SmartContract {
  static bind(address: Address): PoolsharkRouter {
    return new PoolsharkRouter("PoolsharkRouter", address);
  }
}