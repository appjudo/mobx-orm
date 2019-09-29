// Copyright (c) 2017-2019 AppJudo Inc.  MIT License.

export { default as ObservableList, List, PaginatedObservableList } from './ObservableList';
import { List } from './ObservableList';

export type Id = string;
export type StaticUrl = string;
export type DynamicUrl<T> = (value: T) => string | undefined;
export type Url<T> = StaticUrl | DynamicUrl<T>;

export type ItemResponseMapper<T> = (data: any, context: any) => T | undefined;
export type ListResponseMapper<T> = (data: any, context: any) => List<T>;

export interface ListOptions {
  /** Name of sort type to apply. */
  sort?: string;
  /** Filter names/values to apply. */
  filters?: Record<string, string>;
  /** True if the sort should be reversed. */
  reverse?: boolean;
  /** Search keywords query string. */
  search?: string;
  /** Number of records per page, or `0` for no pagination. */
  pageSize?: number;
}

export interface LocalStorage {
  getItem: (name: string) => (string | undefined | Promise<string | undefined>);
  setItem: (name: string, value: string) => (string | Promise<string>);
  removeItem: (name: string) => void;
  clear: () => void;
}

export interface ModelObject {
  id?: Id;
}
