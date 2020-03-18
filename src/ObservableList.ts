// Copyright (c) 2017-2020 AppJudo Inc.  MIT License.

import { action, extendObservable, isObservable, observable, runInAction, IObservableArray } from 'mobx';
import lodash from 'lodash';

export interface List<T> extends Array<T> {
  metadata?: any;
  totalLength?: any;
}

type ListProvider<T> = (...args: number[]) => Promise<List<T>>;
type PaginatedListProvider<T> = (pageSize: number, pageIndex?: number) => Promise<List<T>>;

const ObservableArray = observable.array().constructor as {
  new(initialValues: any, enhancer: any, name?: any): IObservableArray,
};

// Adapted from MobX 4.x internals; variable names preserved from original source.
function deepEnhancer(v: any, _: any, name: any) {
  // it is an observable already, done
  if (isObservable(v))
      return v;
  // something that can be converted and mutated?
  if (Array.isArray(v))
      return observable.array(v, { name });
  return v;
}

// Used to mask MobX illegal-access errors that occur by combining read/write methods
// from MobX observable object into MobX observable array-object hybrid.
function illegalAccessNoOp() {};

class ObservableArrayObjectHybrid extends ObservableArray {
  constructor() {
    super([], deepEnhancer);
    const _this = this as any;
    const obj: any = observable({});
    _this['$mobx'].read = obj['$mobx'].read;
    _this['$mobx'].write = obj['$mobx'].write;
    _this['$mobx'].illegalAccess = illegalAccessNoOp;
  }
}

export abstract class BaseObservableList<T> extends ObservableArrayObjectHybrid {
  abstract promise: Promise<List<T>>;

  provider: ListProvider<T>;

  @observable isLoading: boolean = true;
  @observable isReloading: boolean = false;
  @observable error?: Error;
  @observable metadata?: any;

  constructor(provider: ListProvider<T>) {
    super();
    this.provider = provider;
  }

  abstract reset(): void;
  abstract reload(clear?: boolean): Promise<List<T>>;
  abstract preload(): Promise<List<T>>;
}

export default class ObservableList<T> extends BaseObservableList<T> {
  promise: Promise<List<T>>;

  constructor(provider: ListProvider<T>, initialArray?: List<T>) {
    super(provider);
    const promise = initialArray ? Promise.resolve(initialArray) : provider();
    this.promise = promise.then(action((data: List<T>) => {
      this.isLoading = false;
      this.replace(data || []);
      if ('metadata' in data) {
        this.metadata = data.metadata;
      }
      return data;
    })).catch(action((error: Error) => {
      this.replace([]);
      this.isLoading = false;
      this.error = error;
      throw error;
    }));
  }

  @action reset() {
    this.replace([]);
  }

  @action reload(clear: boolean = false): Promise<List<T>> {
    return runInAction(() => {
      if (clear) this.replace([]);
      if (this.isLoading) {
        return this.promise;
      }
  
      this.error = undefined;
      this.promise = this.provider().then(action((data: List<T>) => {
        this.isLoading = false;
        this.isReloading = false;
        this.replace(data || []);
        attachMetadata(this, data);
        return data;
      })).catch(action((error: Error) => {
        this.replace([]);
        this.isLoading = false;
        this.isReloading = false;
        this.error = error;
        throw error;
      }));
  
      this.isLoading = true;
      this.isReloading = true;
      return this.promise;
    });
  }

  @action preload(): Promise<List<T>> {
    return this.isLoading ? this.promise : this.reload();
  }
}

export class PaginatedObservableList<T> extends BaseObservableList<T | undefined> {
  promise: Promise<List<T>>;
  provider: PaginatedListProvider<T>;

  pageIndex: number = 0;
  pageSize: number;

  @observable pages: IObservableArray<List<T> | undefined>;
  @observable pagePromises: IObservableArray<Promise<List<T>> | undefined>;
  @observable loadedPageIndexes: number[];
  @observable loadingPageCount: number = 0;

  @observable totalLength: number = 0;
  @observable isFullyLoaded: boolean = false;
  @observable versionNumber: number = 1;
  
  constructor(provider: PaginatedListProvider<T>, pageSize: number) {
    super(provider);
    this.provider = provider;
    this.pageSize = pageSize;

    this.pages = observable.array();
    this.pagePromises = observable.array();
    this.loadedPageIndexes = observable.array();

    const pageIndex = this.pageIndex;

    this.promise = provider(pageSize, pageIndex).then(action((data: List<T>) => {
      const startIndex = pageSize * pageIndex;
      while (this.length < startIndex) {
        this.push(undefined);
      }
      for (let index = 0; index < data.length; index++) {
        this[startIndex + index] = data[index];
      }
      this.pageIndex++;
      attachMetadata(this, data);
      this.isLoading = false;
      this.isFullyLoaded = this.length >= this.totalLength;
      return data;
    })).catch(action((error: Error) => {
      this.isLoading = false;
      this.error = error;
      throw error;
    }));
  }

  @action reset() {
    this.replace([]);
    this.isFullyLoaded = false;
    this.pageIndex = 0;
    this.totalLength = 0;
    this.versionNumber++;
  }

  @action reload(clear?: boolean): Promise<List<T | undefined>> {
    return runInAction(() => {
      if (clear) this.reset();
      if (this.isReloading) return this.promise;
  
      this.error = undefined;
      return this.getPageAtIndex(0, !clear);
    });
  }

  @action preload(): Promise<List<T | undefined>> {
    return runInAction(() => {
      if (this.pageIndex > 0) {
        return Promise.resolve(this.slice());
      }
      if (this.isLoading) {
        return this.promise;
      }
      return this.getNextPage();
    });
  }

  @action getNextPage(): Promise<List<T>> {
    if (this.isFullyLoaded) {
      return Promise.resolve(attachMetadata([], this) as List<T>);
    }
    return this.getPageAtIndex(this.pageIndex);
  }

  @action getPageAtIndex(pageIndex: number, clear?: boolean): Promise<List<T>> {
    this.error = undefined;
  
    // Cache these values here as local constants for reliable usage in nested closure scopes.
    const {pageSize} = this;
    let pagePromise = this.pagePromises[pageIndex];
    if (pagePromise) {
      return pagePromise;
    }
    const version = this.versionNumber;
    pagePromise = this.provider(pageSize, pageIndex).then(action((data: List<T>) => {
      if (clear) this.reset();
  
      // Check that list has not been reloaded/reset since page request was made.
      if (version === this.versionNumber) {
        const startIndex = pageSize * pageIndex;
        while (this.length < startIndex) {
          this.push(undefined);
        }
        for (let index = 0; index < data.length; index++) {
          this[startIndex + index] = data[index];
        }
        this.loadedPageIndexes.push(pageIndex);
        const pages = this.pages.slice();
        pages[pageIndex] = data;
        this.pages.replace(pages);
        this.pageIndex = Math.max(this.pageIndex, pageIndex + 1);
        attachMetadata(this, data);
        this.loadingPageCount--;
        this.isLoading = !!this.loadingPageCount;
        const totalPageCount = Math.ceil(this.totalLength / pageSize);
        this.isFullyLoaded = this.loadedPageIndexes.length === totalPageCount;
      }
      return data;
    })).catch(action((error: Error) => {
      debugger;
      if (version === this.versionNumber) {
        this.loadingPageCount--;
        this.isLoading = !!this.loadingPageCount;
      }
      this.error = error;
      throw error;
    }));
    const pagePromises = this.pagePromises.slice();
    pagePromises[pageIndex] = pagePromise;
    this.pagePromises.replace(pagePromises);
    this.loadingPageCount++;
    this.isLoading = true;
  
    this.promise = Promise.all([this.promise, pagePromise]).then(() => {
      if (this.loadingPageCount) {
        return this.promise;
      }
      return this.loadedPageIndexes.sort().map((index) => this.pages[index]).flat();
    });
  
    return pagePromise;
  }

  getItemAtIndex(itemIndex: number, clear?: boolean): T | undefined {
    if (this.isItemLoadedAtIndex(itemIndex)) {
      return this[itemIndex];
    }
    const pageIndex = Math.floor(itemIndex / this.pageSize);
    this.getPageAtIndex(pageIndex, clear);
    return undefined;
  }

  isItemLoadedAtIndex(itemIndex: number) {
    return this.length > itemIndex && !lodash.isUndefined(this[itemIndex]);
  }
}

function attachMetadata<T>(target: List<T> | PaginatedObservableList<T>, source: List<T>) {
  return runInAction(() => {
    if ('metadata' in source) {
      target.metadata = source.metadata;
    }
    if ('totalLength' in source) {
      target.totalLength = source.totalLength;
    }
    return target;
  });
}

export function getObservableListFromArray<T>(sourceArray: List<T> = []): ObservableList<T> {
  return new ObservableList(() => Promise.resolve(sourceArray));
}

export function getPaginatedObservableListFromArray<T>(
  sourceArray: List<T> = [],
  pageSize: number,
): PaginatedObservableList<T> {
  const provider = (pageSize: number, pageIndex: number = 0) => {
    const startIndex = pageIndex * pageSize;
    const result: List<T> = sourceArray.slice(startIndex, pageSize);
    attachMetadata(result, sourceArray);
    return Promise.resolve(result);
  };
  return new PaginatedObservableList(provider, pageSize);
}
