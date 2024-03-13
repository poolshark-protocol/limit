// THIS IS AN AUTOGENERATED FILE. DO NOT EDIT THIS FILE DIRECTLY.

import {
  Address,
  DataSourceTemplate,
  DataSourceContext
} from "@graphprotocol/graph-ts";

export class LimitPoolTemplate extends DataSourceTemplate {
  static create(address: Address): void {
    DataSourceTemplate.create("LimitPoolTemplate", [address.toHex()]);
  }

  static createWithContext(address: Address, context: DataSourceContext): void {
    DataSourceTemplate.createWithContext(
      "LimitPoolTemplate",
      [address.toHex()],
      context
    );
  }
}

export class PositionERC1155Template extends DataSourceTemplate {
  static create(address: Address): void {
    DataSourceTemplate.create("PositionERC1155Template", [address.toHex()]);
  }

  static createWithContext(address: Address, context: DataSourceContext): void {
    DataSourceTemplate.createWithContext(
      "PositionERC1155Template",
      [address.toHex()],
      context
    );
  }
}

export class RangeStakerTemplate extends DataSourceTemplate {
  static create(address: Address): void {
    DataSourceTemplate.create("RangeStakerTemplate", [address.toHex()]);
  }

  static createWithContext(address: Address, context: DataSourceContext): void {
    DataSourceTemplate.createWithContext(
      "RangeStakerTemplate",
      [address.toHex()],
      context
    );
  }
}
