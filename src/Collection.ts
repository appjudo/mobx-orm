// Copyright (c) 2017-2020 AppJudo Inc.  MIT License.

import { action, computed, extendObservable, observable } from 'mobx';
import Model from './Model';
import Repository, { EmptyRepository } from './Repository';
import {
  CollectionOptions,
  Filters,
  ModelObject,
  ObservableList,
  PaginatedObservableList,
  Context,
} from './types';
import {
  BaseObservableList,
  List,
} from './ObservableList';

abstract class BaseCollection<T extends Model<any>> {
  @observable protected _repository: Repository<T>;
  @observable protected _options: CollectionOptions<T>;

  protected _data?: BaseObservableList<T>;

  constructor(repository: Repository<T>, options: CollectionOptions<T> = {}) {
    this._repository = repository;
    this._options = observable({filters: {}, ...options});
  }

  abstract get data(): (ObservableList<T> | PaginatedObservableList<T>);

  /* Deprecated. Use [[data]] instead. */
  abstract get all(): (ObservableList<T> | PaginatedObservableList<T>);

  @computed get repository() {
    return this._repository;
  }

  /** True if the collection is loading new or more data. */
  @computed get isLoading(): boolean {
    return this.data.isLoading;
  }

  /** Length of the filtered data set in this collection (ignoring any pagination). */
  @computed get length(): number {
    return this.data.length;
  }

  getById(id: string, reload: boolean = false) {
    return this._repository.getById(id, reload, this._options.context);
  }

  @action async add(item: T, append: boolean = false) {
    const result = await this._repository.add(item, this._options.context);
    if (append && this._data) {
      if (this._data.isLoading) {
        try {
          await this._data.loadingPromise;
        } catch (error) {
          console.warn('Promise rejected on ObservableList; cannot append item');
          return result;
        }
      }
      this._data!.push(result || item);
    }
    return result;
  }

  @action update(item: T, values?: Partial<T>) {
    return this._repository.update(item, values, this._options.context);
  }

  @action async delete(item: T, remove: boolean = false) {
    const result = await this._repository.delete(item, this._options.context);
    if (remove && this._data) {
      if (this._data.isLoading) {
        await this._data.loadingPromise;
      }
      const index = this._data.findIndex(matches(item));
      if (index !== -1) {
        this._data.splice(index, 1);
      }
    }
    return result;
  }

  @action async deleteAll(remove: boolean = false) {
    const result = await this._repository.deleteAll(this._options);
    if (remove && this._data) {
      if (this._data.isLoading) {
        await this._data.loadingPromise;
      }
      this._data.splice(0, this.length);
    }
    return result;
  }

  sort(sort: string) {
    return this._clone({sort});
  }

  filter(filters: Filters) {
    return this._clone({filters: {...this._options.filters, ...filters}});
  }

  reverse() {
    return this._clone({reverse: !this._options.reverse});
  }

  search(search: string | undefined) {
    return this._clone({search});
  }

  context(context: Context<T> | undefined) {
    return this._clone({context});
  }

  protected _clone(options: CollectionOptions<T>): this {
    options = {...this._options, ...options};
    return new (<any> this.constructor)(this._repository, options);
  }
}

export default class Collection<T extends Model<any>> extends BaseCollection<T> {
  protected _data?: ObservableList<T>;

  constructor(repository: Repository<T>, options: CollectionOptions<T> = {}) {
    super(repository, options);
    this._repository = repository;
    this._options = observable({filters: {}, ...options});
  }

  /**
   * @returns MobX observable array of data from this collection.
   * Initially the array returned will be empty, but it will be filled with
   * data after data after the data is fetched from this collection's repository.
   */
  @computed get data(): ObservableList<T> {
    if (!this._data) {
      const provider = () => this._repository.list(this._options);
      this._data = new ObservableList(provider);
    }
    return this._data;
  }

  /* Deprecated. Use [[data]] instead. */
  @computed get all(): ObservableList<T> {
    return this.data;
  }

  list(initialArray?: List<T>): ObservableList<T> {
    if (!initialArray) {
      return this.data;
    }
    const provider = () => this._repository.list(this._options);
    return new ObservableList(provider, initialArray);
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
}

const DEFAULT_PAGE_SIZE = 10;

export class PaginatedCollection<T extends Model<any>> extends BaseCollection<T> {
  protected _data?: PaginatedObservableList<T>;

  constructor(repository: Repository<T>, options: CollectionOptions<T> = {}) {
    super(repository, options);
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
      const provider = (pageSize?: number, pageIndex: number = 0) => this._repository.list(this._options, pageIndex);
      this._data = new PaginatedObservableList(provider, this._options.pageSize!);
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

  forEach(callback: (item: T | undefined) => any): void {
    this.data.forEach(callback);
  }

  map<U>(transform: (item: T | undefined) => U): U[] {
    return this.data.map(transform);
  }

  find(predicate: (item: T | undefined) => boolean) {
    return this.data.find(predicate);
  }
}

export class EmptyCollection<T extends Model<any>> extends Collection<T> {
  constructor() {
    super(new EmptyRepository<T>());
  }
}

function matches<T extends ModelObject>(item: T) {
  return (otherItem: T | undefined) => (otherItem
    ? (otherItem === item || (otherItem.id ? otherItem.id === item.id : false))
    : false);
}
