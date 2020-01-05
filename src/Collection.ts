// Copyright (c) 2017-2019 AppJudo Inc.  MIT License.

import { action, computed, extendObservable, observable } from 'mobx';
import Repository, { EmptyRepository } from './Repository';
import { CollectionOptions, ModelObject, ObservableList, PaginatedObservableList } from './types';
import {
  BaseObservableList,
  getObservableListFromProvider,
  getPaginatedObservableListFromProvider,
} from './ObservableList';

abstract class BaseCollection<T extends ModelObject> {
  @observable protected _source: Repository<T>;
  @observable protected _options: CollectionOptions;

  protected _data?: BaseObservableList<T>;

  constructor(source: Repository<T>, options: CollectionOptions = {}) {
    this._source = source;
    this._options = observable({filters: {}, ...options});
  }

  abstract get data(): (ObservableList<T> | PaginatedObservableList<T>);

  /* Deprecated. Use [[data]] instead. */
  abstract get all(): (ObservableList<T> | PaginatedObservableList<T>);

  /** True if the collection is loading new or more data. */
  @computed get isLoading(): boolean {
    return this.data.isLoading;
  }

  /** Length of the filtered data set in this collection (ignoring any pagination). */
  @computed get length(): number {
    return this.data.length;
  }

  async getById(id: string) {
    return await this._source.getById(id);
  }

  @action async add(item: T, append: boolean = false) {
    const result = await this._source.add(item);
    if (append && this._data) {
      if (this._data.isLoading) {
        try {
          await this._data.promise;
        } catch (error) {
          console.warn('Promise rejected on ObservableList; cannot append item');
          return result;
        }
      }
      this._data!.push(result || item);
    }
    return result;
  }

  @action async update(item: T) {
    return await this._source.update(item);
  }

  @action async delete(item: T, remove: boolean = false) {
    const result = await this._source.delete(item);
    if (remove && this._data) {
      if (this._data.isLoading) {
        await this._data.promise;
      }
      const index = this._data.findIndex(matches(item));
      if (index !== -1) {
        this._data.splice(index, 1);
      }
    }
    return result;
  }

  @action async deleteAll(remove: boolean = false) {
    const result = await this._source.deleteAll();
    if (remove && this._data) {
      if (this._data.isLoading) {
        await this._data.promise;
      }
      this._data.splice(0, this.length);
    }
    return result;
  }

  sort(sort: string) {
    return this._clone({sort});
  }

  filter(filters: Record<string, string | undefined>) {
    return this._clone({filters: {...this._options.filters, ...filters}});
  }

  reverse() {
    return this._clone({reverse: !this._options.reverse});
  }

  search(search: string | undefined) {
    return this._clone({search});
  }

  forEach(callback: (item: T) => any): void {
    this.data.forEach(callback);
  }

  map<U>(transform: (item: T) => U): U[] {
    return this.data.map(transform);
  }

  find(predicate: (item: T) => boolean) {
    return this.data.find(predicate);
  }

  protected _clone(options: CollectionOptions): this {
    options = {...this._options, ...options};
    return new (<any> this.constructor)(this._source, options);
  }
}

export default class Collection<T extends ModelObject> extends BaseCollection<T> {
  protected _data?: ObservableList<T>;

  constructor(source: Repository<T>, options: CollectionOptions = {}) {
    super(source, options);
    this._source = source;
    this._options = observable({filters: {}, ...options});
  }

  /**
   * @returns MobX observable array of data from this collection.
   * Initially the array returned will be empty, but it will be filled with
   * data after data after the data is fetched from this collection's repository.
   */
  @computed get data(): ObservableList<T> {
    if (!this._data) {
      const provider = () => this._source.list(this._options);
      this._data = getObservableListFromProvider(provider);
    }
    return this._data;
  }

  /* Deprecated. Use [[data]] instead. */
  @computed get all(): ObservableList<T> {
    return this.data;
  }
}

const DEFAULT_PAGE_SIZE = 10;

export class PaginatedCollection<T extends ModelObject> extends BaseCollection<T> {
  protected _data?: PaginatedObservableList<T>;

  constructor(source: Repository<T>, options: CollectionOptions = {}) {
    super(source, options);
    super(source, options);
    if (!this._options.pageSize) {
      extendObservable(this._options, {pageSize: DEFAULT_PAGE_SIZE});
    }
  }

  /**
   * @returns MobX observable array of data from this collection.
   * Initially the array returned will be empty, but it will be filled with
   * data after data after the data is fetched from this collection's repository.
   */
  @computed get data(): PaginatedObservableList<T> {
    if (!this._data) {
      const provider = (pageSize?: number, pageIndex: number = 0) =>
        this._source.list(this._options, pageIndex);
      this._data = getPaginatedObservableListFromProvider(provider, this._options.pageSize!);
    }
    return this._data as PaginatedObservableList<T>;
  }

  /* Deprecated. Use [[data]] instead. */
  @computed get all(): PaginatedObservableList<T> {
    return this.data;
  }

  pageSize(pageSize: number): PaginatedCollection<T> {
    return this._clone({pageSize});
  }
}

export class EmptyCollection<T extends ModelObject> extends Collection<T> {
  constructor() {
    super(new EmptyRepository<T>());
  }
}

function matches<T extends ModelObject>(item: T) {
  return (otherItem: T) => (otherItem === item || (otherItem.id ? otherItem.id === item.id : false));
}
