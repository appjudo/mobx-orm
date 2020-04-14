// Copyright (c) 2017-2020 AppJudo Inc.  MIT License.

export { default as ObservableList, List, PaginatedObservableList } from './ObservableList';
import { List } from './ObservableList';

export type Awaitable<T> = Promise<T> | T;

export type Id = string;
export type StaticUrl = string;
export type DynamicUrl<T extends ModelObject> = (value: Id | T) => string | undefined;
export type Url<T> = StaticUrl | DynamicUrl<T>;

export type ItemResponseMapper<T> = (data: any, context: any) => T | undefined;
export type ListResponseMapper<T> = (data: any, context: any) => List<T>;
export type ListDeleteAllResponseMapper<T> = (data: any, context: any) => List<T> | boolean;

export interface CollectionOptions {
  /** Name of sort type to apply. */
  sort?: string;
  /** Filter names/values to apply. */
  filters?: Record<string, string | undefined>;
  /** True if the sort should be reversed. */
  reverse?: boolean;
  /** Search keywords query string. */
  search?: string;
  /** Number of records per page, or `0` for no pagination. */
  pageSize?: number;
}

export interface LocalStorage {
  getItem: (name: string) => Awaitable<string | undefined>;
  setItem: (name: string, value: string) => Awaitable<string>;
  removeItem: (name: string) => void;
  clear: () => void;
}

export interface ModelObject {
  id?: Id;
}

export type Constructor<T> = new (...args: any[]) => T;

export type InstantiableParameter<T> = T | ConstructorParameters<Constructor<T>>[0];

export function instantiate<T>(klass: Constructor<T>, params: InstantiableParameter<T>): T {
  return (params instanceof klass) ? params : new klass(params);
}

export function isUndefined(value: any): boolean {
  return typeof value === 'undefined';
}
