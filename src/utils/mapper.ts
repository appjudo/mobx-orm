// Copyright (c) 2017-2020 AppJudo Inc.  MIT License.

/* eslint-disable import/prefer-default-export */

import lodash from 'lodash';

export function mapper<SourceType extends object, TargetType extends object, A extends any[] = []>(
  resultKeys: (keyof TargetType)[],
  innerMapper: (values: Partial<SourceType>, ...args: A) => Partial<TargetType>,
): (values: Partial<SourceType>, ...args: A) => TargetType {
  return (values: Partial<SourceType>, ...args: A) => {
    const innerResult = innerMapper(values, ...args);
    const innerResultKeys = Object.keys(innerResult) as (keyof TargetType)[];
    return {
      ...lodash.pick(values, lodash.without(resultKeys, ...innerResultKeys) as string[]),
      ...innerResult,
    } as TargetType;
  };
}

type ObjectDefinedConstructor<O extends object, U = object> = new (object: O, ...args: any[]) => U;
type ObjectDefinedConstructorRestParameters<O extends object, C extends ObjectDefinedConstructor<O>> =
  C extends new (object: O, ...args: infer P) => any ? P : never;

export function constructorMapper<
  SourceType extends object,
  ConstructorFirstArgType extends object,
  ConstructorType extends object,
  ConstructorOtherArgTypes extends any[] = [],
  C extends ObjectDefinedConstructor<ConstructorFirstArgType, ConstructorType> =
    ObjectDefinedConstructor<ConstructorFirstArgType, ConstructorType>,
>(
  constructor: C,
  resultKeys: (keyof ConstructorFirstArgType)[],
  innerMapper: (values: SourceType, ...args: ConstructorOtherArgTypes) =>
    (Partial<ConstructorFirstArgType> | [
      Partial<ConstructorFirstArgType>,
      ObjectDefinedConstructorRestParameters<ConstructorFirstArgType, C>,
    ]),
): (values: SourceType, ...args: ConstructorOtherArgTypes) => ConstructorType {
  return (values: SourceType, ...args: ConstructorOtherArgTypes) => {
    const innerResult = innerMapper(values, ...args);
    const target = lodash.isArray(innerResult) ? innerResult[0] : innerResult;
    const targetKeys = Object.keys(target) as (keyof ConstructorFirstArgType)[];
    const merged = {
      ...lodash.pick(values, lodash.without(resultKeys, ...targetKeys) as string[]),
      ...target,
    } as ConstructorFirstArgType;
    return lodash.isArray(innerResult)
      ? new constructor(merged, ...innerResult[1])
      : new constructor(merged);
  };
}
