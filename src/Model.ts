// Copyright (c) 2017-2019 AppJudo Inc.  MIT License.

import { action, computed, observable } from 'mobx';

import Repository from './Repository';
import { ModelObject } from './types';

export default abstract class Model<T extends ModelObject> {
  @observable protected _repository?: Repository<T>;

  @computed get repository() {
    return this._repository;
  }

  @action update(values?: Partial<T>) {

  }
}
