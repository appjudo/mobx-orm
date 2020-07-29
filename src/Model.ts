// Copyright (c) 2017-2020 AppJudo Inc.  MIT License.

import { action, computed, observable } from 'mobx';

import Repository from './Repository';
import { Id, ModelObject } from './types';

interface UpdateOptions<T extends Model<T>> {
  repository?: Repository<T>;
}

class ModelOrmData<T extends Model<T>> {
  @observable isLoading: boolean = false;
  @observable isReloading: boolean = false;
  @observable loadingPromise?: Promise<T | undefined>;

  @observable isSaving: boolean = false;
  @observable savingPromise?: Promise<T | undefined>;

  @observable repository?: Repository<T>;

  // Deprecated.
  @computed get promise() {
    return this.loadingPromise;
  }
}

export default abstract class Model<T extends Model<T>> {
  @observable id?: Id;
  @observable _orm: ModelOrmData<T>;

  constructor() {
    this._orm = new ModelOrmData();
  }

  /* eslint-disable-next-line class-methods-use-this */
  get isFullyLoaded(): boolean {
    return true;
  }

  @action async update(values: Partial<T> = {}, options: UpdateOptions<T> = {}) {
    const repository = options.repository || this._orm.repository;
    if (!repository) {
      throw new Error('Model `update` method called without repository');
    }
    const itemId = this[repository.idKey as keyof this] as unknown as Id;
    if (!itemId) {
      throw new Error(`Model \`update\` requires \`${repository.idKey}\` to be present`);
    }
    this._orm.savingPromise = repository.update(values);
    this._orm.isSaving = true;
    const result = await this._orm.savingPromise;
    Object.assign(this, values);
    this._orm.isSaving = false;
    return result;
  }

  @action async save(repository?: Repository<T>) {
    if (!repository) repository = this._orm.repository;
    if (!repository) {
      throw new Error('Model `save` method called without repository');
    }
    const idKey = repository.idKey as keyof this;
    const itemId = this[idKey] as unknown as Id;
    this._orm.savingPromise = repository[itemId ? 'update' : 'add'](this as unknown as T);
    this._orm.isSaving = true;
    const result = await this._orm.savingPromise;
    if (result && !itemId) this[idKey] = result[repository.idKey] as any;
    this._orm.isSaving = false;
    return result;
  }

  @action async reload(repository?: Repository<T>) {
    if (!repository) repository = this._orm.repository;
    if (!repository) {
      throw new Error('Model `reload` method called without repository');
    }
    const result = repository.reload(this as unknown as T);
    return result;
  }
}
