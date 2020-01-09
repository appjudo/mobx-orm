// Copyright (c) 2017-2020 AppJudo Inc.  MIT License.

import { action, computed, observable } from 'mobx';

import Repository from './Repository';
import { Id, ModelObject } from './types';

export default abstract class Model<T extends ModelObject> {
  @observable id?: Id;
  @observable _isLoading: boolean = false;
  @observable _promise?: Promise<T | undefined>;
  @observable protected _repository?: Repository<T>;

  get isFullyLoaded(): boolean {
    return true;
  }

  @computed get repository() {
    return this._repository;
  }

  @action update(values: Partial<T> = {}) {
    Object.assign(this, values);
    this.save();
  }

  @action save(repository?: Repository<T>) {
    if (!repository) repository = this._repository;
    if (!repository) {
      throw new Error('Model `save` method called without repository');
    }
    const itemId = this[repository.idKey as keyof this] as unknown as Id;
    return repository[itemId ? 'update' : 'add'](this as unknown as T);
  }

  @action reload(repository?: Repository<T>) {
    if (!repository) repository = this._repository;
    if (!repository) {
      throw new Error('Model `reload` method called without repository');
    }
    return repository.reload(this as unknown as T);
  }
}
