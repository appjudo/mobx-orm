// Copyright (c) 2017-2019 AppJudo Inc.  MIT License.

import { action, observable } from 'mobx';
import { ListOptions, ModelObject, ObservableList } from './types';
import { getObservableListFromProvider, List } from './ObservableList';

export default abstract class Repository<T extends ModelObject> {
  abstract async list(options?: ListOptions, pageIndex?: number): Promise<List<T>>;
  abstract async getById(id: string): Promise<T | undefined>;
  abstract async add(item: T): Promise<T | undefined>;
  abstract async update(item: T): Promise<T | undefined>;
  abstract async delete(item: T): Promise<any>;
  abstract async deleteAll(options?: ListOptions): Promise<List<T>>;

  @action listObservable(options?: ListOptions): ObservableList<T> {
    return getObservableListFromProvider(() => this.list(options));
  }
}

export class EmptyRepository<T extends ModelObject> extends Repository<T> {
  @action async list(options?: ListOptions): Promise<List<T>> {
    return [];
  }

  @action async getById(id: string): Promise<T | undefined> {
    return undefined;
  }

  @action async add(item: T): Promise<T> {
    throw new Error("Can't add items to EmptyRepository");
  }

  @action async update(item: T): Promise<T> {
    throw new Error("Can't update items in EmptyRepository");
  }

  @action async delete(item: T): Promise<any> {}

  @action async deleteAll(options?: ListOptions): Promise<any> {}
}
