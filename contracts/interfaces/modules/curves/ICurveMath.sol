// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.13;

import './IDyDxMath.sol';
import './ITickMath.sol';

interface ICurveMath is 
    IDyDxMath,
    ITickMath
{}
