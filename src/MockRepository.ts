// Copyright (c) 2017-2019 AppJudo Inc.  MIT License.

import { action, observable, IObservableArray } from 'mobx';
import lodash from 'lodash';

import Repository from './Repository';
import { List, ListOptions, ModelObject } from './types';
import { getObservableListFromArray } from './ObservableList';

type FilterFunction<T> = (value: string) => ((item: T) => boolean);
type SortByIteratee<T> = string | ((a: T) => any);
type SortByIteratees<T> = SortByIteratee<T>[];
type SortComparator<T> = (a: T, b: T) => number;
type SortConfig<T> = SortByIteratee<T> | SortByIteratees<T> | SortComparator<T>;

const ADD_DELAY_MS = 300;
const FETCH_DELAY_MS = 1000;

export interface MockRepositoryConfig<T> {
  filter?: {[key: string]: FilterFunction<T>},
  search?: FilterFunction<T>,
  sort?: {[key: string]: SortConfig<T>},
}

export default class MockRepository<T extends ModelObject> extends Repository<T> {
  @observable private _data: IObservableArray<T>;
  @observable private _config: MockRepositoryConfig<T>;

  // TODO: Add metadata and totalLength.

  constructor(config: MockRepositoryConfig<T> = {}, data?: List<T>) {
    super();
    this._config = Object.assign({filter: {}, sort: {}}, config);
    this._data = observable.array();
    if (data) {
      this.setData(data);
    }
  }

  @action setData(data: List<T>) {
    this._data.replace(data);
  }

  @action add(item: T): Promise<T> {
    return new Promise((resolve: Function, reject: Function) => {
      setTimeout(() => {
        if (!this._data.find(otherItem => otherItem === item)) {
          this._data.push(item);
        }
        resolve(item);
      }, ADD_DELAY_MS);
    });
  }

  @action getById(id: string): Promise<T> {
    return new Promise((resolve: Function, reject: Function) => {
      setTimeout(() => {
        const item = this._data.find(item => item.id === id);
        resolve(item);
      }, FETCH_DELAY_MS);
    });
  }

  @action delete(item: T): Promise<undefined> {
    return new Promise((resolve: Function, reject: Function) => {
      setTimeout(() => {
        const index = this._data.findIndex(otherItem => otherItem.id === item.id);
        this._data.splice(index, 1);
        resolve(undefined);
      }, FETCH_DELAY_MS);
    });
  }

  @action update(item: T): Promise<T | undefined> {
    throw new Error('Not implemented yet');
  }

  @action list(options: ListOptions = {}, pageIndex?: number): Promise<List<T>> {
    return new Promise(action((resolve: Function, reject: Function) => {
      setTimeout(() => {
        let data = this._data.slice(0);
        if (options.filters) {
          for (let filterName in options.filters) {
            const filterFunction = this._config.filter && this._config.filter[filterName];
            if (!filterFunction) {
              throw new Error(`Repository has no filter named '${filterName}'`);
            }
            const filterValue = options.filters[filterName];
            data = data.filter(filterFunction(filterValue));
          }
        }
        if (options.sort) {
          let sortConfig = this._config.sort && this._config.sort[options.sort];
          if (!sortConfig) {
            throw new Error(`Repository has no sort named '${options.sort}'`);
          }
          if (typeof sortConfig === 'string' || sortConfig.length === 1) {
            sortConfig = [sortConfig as SortByIteratee<T>];
          }
          if (Array.isArray(sortConfig)) {
            // SortByIteratees.
            const sortByIteratees = sortConfig.slice(0) as SortByIteratees<T>;
            const sortOrder = sortByIteratees.map((iteratee, index) => {
              let reverse = options.reverse;
              if (typeof iteratee === 'string' && iteratee.trim()[0] === '-') {
                sortByIteratees[index] = iteratee.trim().substr(1);
                reverse = !reverse;
              }
              return reverse ? 'desc' : 'asc';
            });
            data = lodash.orderBy(data, sortByIteratees, sortOrder);
          } else {
            let sortComparator = sortConfig as SortComparator<T>;
            data = data.sort(options.reverse ? ((a: T, b: T) => -sortComparator(a, b)) : sortComparator);
          }
        }
        if (options.search) {
          const query = options.search;
          const searchFunction = this._config.search;
          if (!searchFunction) {
            throw new Error(`Repository has no search function`);
          }
          data = data.filter(searchFunction(query));
        }
        resolve(getObservableListFromArray(data));
      }, FETCH_DELAY_MS);
    }));
  }

  @action async deleteAll(options: ListOptions = {}): Promise<List<T>> {
    this._data.replace([]);
    return this._data;
  }
}
