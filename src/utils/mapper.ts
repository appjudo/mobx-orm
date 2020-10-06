// Copyright (c) 2017-2020 AppJudo Inc.  MIT License.

/* eslint-disable import/prefer-default-export */

import lodash from 'lodash';

export function mapper<T extends object, U extends object, A extends any[] = []>(
  resultKeys: (keyof U)[],
  innerMapper: (values: Partial<T>, ...args: A) => Partial<U>,
): (values: Partial<T>, ...args: A) => U {
  return (values: Partial<T>, ...args: A) => {
    const innerResult = innerMapper(values, ...args);
    const innerResultKeys = Object.keys(innerResult) as (keyof U)[];
    return {
      ...lodash.pick(values, lodash.without(resultKeys, ...innerResultKeys) as string[]),
      ...innerResult,
    } as U;
  };
}

type ObjectDefinedConstructor<O extends object, U = object> = new (object: O, ...args: any[]) => U;
type ObjectDefinedConstructorRestParameters<O extends object, C extends ObjectDefinedConstructor<O>> =
  C extends new (object: O, ...args: infer P) => any ? P : never;

export function constructorMapper<
  T extends object,
  D extends object,
  U extends object,
  A extends any[] = [],
  C extends ObjectDefinedConstructor<D, U> = ObjectDefinedConstructor<D, U>,
>(
  constructor: C,
  resultKeys: (keyof D)[],
  innerMapper: (values: Partial<T>, ...args: A) =>
    (Partial<D> | [Partial<D>, ObjectDefinedConstructorRestParameters<D, C>]),
): (values: Partial<T>, ...args: A) => U {
  return (values: Partial<T>, ...args: A) => {
    const innerResult = innerMapper(values, ...args);
    const target = lodash.isArray(innerResult) ? innerResult[0] : innerResult;
    const targetKeys = Object.keys(target) as (keyof D)[];
    const merged = {
      ...lodash.pick(values, lodash.without(resultKeys, ...targetKeys) as string[]),
      ...target,
    } as D;
    return lodash.isArray(innerResult)
      ? new constructor(merged, ...innerResult[1])
      : new constructor(merged);
  };
}
