// Copyright (c) 2017-2020 AppJudo Inc.  MIT License.

import { action, computed, isObservable, observable, runInAction, IObservableArray } from 'mobx';
import lodash from 'lodash';

export interface List<T> extends Array<T> {
  metadata?: any;
  totalLength?: number;
}

export interface ReloadOptions {
  clear: boolean;
}

export interface PaginatedReloadOptions extends ReloadOptions {
  preload: boolean;
}

type ListProvider<T> = (...args: number[]) => Promise<List<T>>;
type PaginatedListProvider<T> = (pageSize: number, pageIndex?: number) => Promise<List<T>>;

const ObservableArray = observable.array().constructor as {
  new(initialValues: any, enhancer: any, name?: any): IObservableArray;
};

// Adapted from MobX 4.x internals; variable names preserved from original source.
function deepEnhancer(v: any, _: any, name: any) {
  /* eslint-disable */
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

export abstract class BaseObservableList<T> extends ObservableArrayObjectHybrid implements List<T> {
  abstract promise: Promise<List<T>>;

  provider: ListProvider<T>;

  @observable isLoading: boolean = true;
  @observable isReloading: boolean = false;
  @observable error?: Error;
  @observable metadata?: any;
  @observable loadedDate?: Date;

  constructor(provider: ListProvider<T>) {
    super();
    this.provider = provider;
  }

  abstract reset(): void;
  abstract reload(options: Partial<ReloadOptions>): Promise<List<T>>;
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
      this.loadedDate = new Date();
      return data;
    }));
    this.promise.catch(action((error: Error) => {
      this.replace([]);
      this.isLoading = false;
      this.error = error;
    }));
  }

  @action reset() {
    this.replace([]);
  }

  @action reload(options: Partial<ReloadOptions> = {}): Promise<List<T>> {
    const clear = options.clear ?? false;
    if (clear) this.replace([]);
    if (this.isLoading) {
      return this.promise;
    }

    this.error = undefined;
    this.loadedDate = undefined;
    this.promise = this.provider().then(action((data: List<T>) => {
      this.isLoading = false;
      this.isReloading = false;
      this.replace(data || []);
      attachMetadata(this, data);
      this.loadedDate = new Date();
      return data;
    }));
    this.promise.catch(action((error: Error) => {
      this.replace([]);
      this.isLoading = false;
      this.isReloading = false;
      this.error = error;
    }));

    this.isLoading = true;
    this.isReloading = true;
    return this.promise;
  }

  @action preload(): Promise<List<T>> {
    return this.isLoading ? this.promise : this.reload();
  }
}

export class PaginatedObservableList<T> extends BaseObservableList<T | undefined> {
  promise: Promise<List<T>>;
  provider: PaginatedListProvider<T>;

  pageSize: number;

  @observable pages: IObservableArray<List<T> | undefined>;
  @observable pagePromises: IObservableArray<Promise<List<T>> | undefined>;
  @observable loadedPageCount: number = 0;
  @observable loadingPageCount: number = 0;

  @observable totalLength: number = -1;
  @observable isFullyLoaded: boolean = false;
  @observable fullyLoadedDate?: Date;
  @observable versionNumber: number;
  @observable nextVersion?: PaginatedObservableList<T>;
  
  constructor(provider: PaginatedListProvider<T>, pageSize: number, versionNumber: number = 1) {
    super(provider);
    this.provider = provider;
    this.pageSize = pageSize;
    this.versionNumber = versionNumber;

    this.pages = observable.array();
    this.pagePromises = observable.array();

    this.promise = Promise.resolve([]);
    this.isLoading = false;
    this.isReloading = false;
    this.isFullyLoaded = false;
  }

  @computed get maxLoadedPageIndex() {
    return this.pages.length - 1;
  }

  @computed get loadingPageIndexes() {
    const result: number[] = [];
    if (this.loadingPageCount) {
      for (let index = 0; index < this.pagePromises.length; index++) {
        if (index >= this.pages.length || !this.pages[index]) {
          result.push(index);
        }
      }
    }
    return result;
  }

  @action reset() {
    this.replace([]);
    this.pages.replace([]);
    this.pagePromises.replace([]);
    this.loadedPageCount = 0;
    this.loadingPageCount = 0;
    this.isFullyLoaded = false;
  }

  @action reload(options: Partial<PaginatedReloadOptions> = {}): Promise<List<T | undefined>> {
    const clear = options.clear ?? false;
    const preload = options.preload ?? false;
    // Cache currently loading page indexes before (possibly) resetting this list.
    const previouslyLoadingPageIndexes = this.loadingPageIndexes;
    if (clear) this.reset();
    this.isReloading = true;
    this.error = undefined;
    this.loadedDate = undefined;
    this.fullyLoadedDate = undefined;
    this.nextVersion = new PaginatedObservableList(this.provider, this.pageSize, this.versionNumber + 1);
    // Reload previously loading page indexes into next version.
    if (preload) this.getPageAtIndex(0);
    previouslyLoadingPageIndexes.forEach(index => this.getPageAtIndex(index));
    return Promise.resolve(this);
  }

  @action preload(): Promise<List<T | undefined>> {
    const list = this.nextVersion || this;
    if (list.totalLength >= 0) {
      return Promise.resolve(list.slice());
    }
    if (list.isLoading) {
      return list.promise;
    }
    return list.getNextPage();
  }

  @action getNextPage(): Promise<List<T>> {
    if (this.isFullyLoaded) {
      return Promise.resolve(attachMetadata([], this) as List<T>);
    }
    return this.getPageAtIndex(this.maxLoadedPageIndex + 1);
  }

  @action getPageAtIndex(pageIndex: number): Promise<List<T>> {
    this.error = undefined;
  
    // Cache these values here as local constants for reliable usage in nested closure scopes.
    const {pageSize} = this;
    const list = this.nextVersion || this;
    let pagePromise = list.pagePromises.length > pageIndex ? list.pagePromises[pageIndex] : undefined;
    if (pagePromise) {
      return pagePromise;
    }
    const loadedVersionNumber = list.versionNumber;
    pagePromise = list.provider(pageSize, pageIndex).then(action((data: List<T>) => {
      // Check that list has not been reloaded/reset since page request was made.
      const latestVersionNumber = this.nextVersion?.versionNumber || this.versionNumber;
      if (loadedVersionNumber === latestVersionNumber) {
        const startIndex = pageSize * pageIndex;
        while (list.length < startIndex) {
          list.push(undefined);
        }
        for (let index = 0; index < data.length; index++) {
          list[startIndex + index] = data[index];
        }

        attachMetadata(list, data);
        list.loadedPageCount++;
        list.isFullyLoaded = list.totalLength >= 0
          && list.loadedPageCount === Math.ceil(list.totalLength / pageSize);

        if (!list.loadedDate) {
          this.loadedDate = new Date();
        }
        if (list.isFullyLoaded && !list.fullyLoadedDate) {
          list.fullyLoadedDate = new Date();
        }

        const pages = list.pages.slice();
        pages[pageIndex] = data;
        list.pages.replace(pages);
        list.loadingPageCount--;

        this.isLoading = !!(this.nextVersion || this).loadingPageCount;
        if (!this.isLoading) {
          if (this.nextVersion) {
            // Copy nextVersion back to this.
            this.replace(this.nextVersion);
            Object.assign(this, this.nextVersion);
            this.isLoading = false;
          }
          this.isReloading = false;
        }
      }
      return data;
    }));
    pagePromise.catch(action((error: Error) => {
      const latestVersionNumber = this.nextVersion?.versionNumber || this.versionNumber;
      if (loadedVersionNumber === latestVersionNumber) {
        list.loadingPageCount--;
        this.isLoading = !!list.loadingPageCount;
        if (!this.isLoading) this.isReloading = false;
      }
      this.error = error;
    }));
    const pagePromises = list.pagePromises.slice();
    pagePromises[pageIndex] = pagePromise;
    list.pagePromises.replace(pagePromises);
    list.loadingPageCount++;
    this.isLoading = true;

    this.promise = list.promise = Promise.all(lodash.compact(pagePromises)).then(() => {
      return list;
    });
    this.promise.catch(() => {});
  
    return pagePromise;
  }

  isItemLoadedAtIndex(itemIndex: number) {
    if (this.nextVersion) {
      const pageIndex = this.getPageIndexFromItemIndex(itemIndex);
      const isPageIndexLoaded = this.nextVersion.pages.length > pageIndex
        && this.nextVersion.pages[pageIndex];
      if (isPageIndexLoaded) {
        this.getPageAtIndex(pageIndex);
      }
    }
    return this.length > itemIndex && !lodash.isUndefined(this[itemIndex]);
  }

  getItemAtIndex(itemIndex: number): T | undefined {
    if (this.isItemLoadedAtIndex(itemIndex)) {
      return this[itemIndex];
    }
    const pageIndex = this.getPageIndexFromItemIndex(itemIndex);
    this.getPageAtIndex(pageIndex);
    return undefined;
  }

  getPageIndexFromItemIndex(itemIndex: number) {
    return Math.floor(itemIndex / this.pageSize);
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
