// Copyright (c) 2017-2020 AppJudo Inc.  MIT License.

import { List } from './ObservableList';
import Model from './Model';
import Repository from './Repository';

export { default as ObservableList, List, PaginatedObservableList } from './ObservableList';

export type Awaitable<T> = Promise<T> | T;

export type Id = string;
export interface Context<T extends Model<any>> extends Record<string, any> {
  repository?: Repository<T>;
}

// export type CollectionResponseMapper<T> = (response: Response, context: any) => List<T>;
// export type DeleteAllResponseMapper<T> = (response: Response, context: any) => List<T> | boolean;
// export type MemberResponseMapper<T> = (response: Response, context: any) => T | undefined;

export type CollectionResponseBodyMapper<T> = (data: any, context: any) => List<T>;
export type DeleteAllResponseBodyMapper<T> = (data: any, context: any) => List<T> | boolean;
export type MemberResponseBodyMapper<T> = (data: any, context: any) => T | undefined;

export type Filters = Record<string, any>;
export type HeadersRecord = Record<string, string | number | boolean | undefined>;
export type ParamsRecord = Record<string, string | number | boolean | undefined>;

export interface CollectionOptions<T extends Model<any>> {
  /** Name of sort type to apply. */
  sort?: string;
  /** Filter names/values to apply. */
  filters?: Filters;
  /** True if the sort should be reversed. */
  reverse?: boolean;
  /** Search keywords query string. */
  search?: string;
  /** Number of records per page, or `0` for no pagination. */
  pageSize?: number;
  /** Other context to be merged with repository's context. */
  context?: Context<T>;
}

export interface LocalStorage {
  getItem: (name: string) => Awaitable<string | null>;
  setItem: (name: string, value: string) => Awaitable<void>;
  removeItem: (name: string) => void;
  clear: () => void;
}

export interface ModelObject {
  id?: Id;
}

export type Constructor<T> = new (...args: any[]) => T;

export type InstantiableParameter<T> = T | ConstructorParameters<Constructor<T>>[0];

export function instantiate<T>(Class: Constructor<T>, params: InstantiableParameter<T>): T {
  return (params instanceof Class) ? params : new Class(params);
}
