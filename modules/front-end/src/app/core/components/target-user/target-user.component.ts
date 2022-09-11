import { Component, EventEmitter, Input, OnInit, Output, ViewChild } from '@angular/core';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzSelectComponent } from 'ng-zorro-antd/select';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { EnvUserService } from '@services/env-user.service';
import { IUserProp, IUserType } from '@shared/types';
import { EnvUserPropService } from "@services/env-user-prop.service";
import {USER_BUILT_IN_PROPERTIES} from "@shared/constants";

@Component({
  selector: 'target-user',
  templateUrl: './target-user.component.html',
  styleUrls: ['./target-user.component.less']
})
export class TargetUserComponent implements OnInit {

  private inputs = new Subject<any>();
  public compareWith: (obj1: IUserType, obj2: IUserType) => boolean = (obj1: IUserType, obj2: IUserType) => {
    if(obj1 && obj2) {
      return obj1.id === obj2.id;
    } else {
      return false;
    }
  };

  @Input() type: string = '';
  @Input() tipIdx: number = 0;
  @Input() tipColor: string = '#7FFFD4';
  @Input() selectedUserDetailList: IUserType[];

  get isLoading() {
    return this.isLoadingUsers || this.isLoadingProps;
  }

  isLoadingUsers = true;
  public userList: IUserType[] = [];
  @Input("userList")
  set list(data: IUserType[]) {
    this.isLoadingUsers = false;
    if (this.selectNode['searchValue'] && data.length === 0) {
      this.userList = [{
        keyId: this.selectNode['searchValue'],
        name: this.selectNode['searchValue'],
        isNew: true
      } as IUserType];
    } else {
      this.userList = [...data];
    }
  }

  isLoadingProps: boolean = true;
  props: IUserProp[] = [];
  getProps() {
    this.envUserPropService.getProp().subscribe(props => {
      this.props = props;
      this.isLoadingProps = false;
    });
  }

  @Output() search = new EventEmitter<string>();    // 搜索用户
  @Output() onSelectedUserListChange = new EventEmitter<IUserType[]>();      // 选择用户发生改变

  public selectModel: IUserType;

  getUserDigest(user: IUserType) {
    const digestProps = this.props.filter(x => x.isDigestField);

    let digests: string[] = [];
    for (const prop of digestProps) {
      const propName = prop.name;

      let propValue = '';
      if (USER_BUILT_IN_PROPERTIES.includes(propName)) {
        // lowercase first letter of propName to get object name
        const fieldName = propName.charAt(0).toLowerCase() + propName.slice(1);
        propValue = user[fieldName] ?? '--';
      } else {
        const customizedPropertyValue = user.customizedProperties?.find(x => x.name === propName)?.value;
        propValue = customizedPropertyValue ? customizedPropertyValue : '--';
      }

      digests.push(`${propName}: ${propValue}`);
    }

    return digests.join(', ');
  }

  constructor(
    private envUserService: EnvUserService,
    private envUserPropService: EnvUserPropService,
    private msg: NzMessageService) {
    this.inputs.pipe(
      debounceTime(500),
      distinctUntilChanged()
    ).subscribe(e => {
      this.search.next(e);
    });
  }

  ngOnInit() {
    this.getProps();
  }

  // 搜索用户
  public onSearch(value: string = '') {
    this.isLoadingUsers = true;
    this.inputs.next(value);
  }

  public isSelected(user: IUserType): boolean {
    return !user.isNew && this.selectedUserDetailList.findIndex(s => s.id === user.id) !== -1;
  }

  removeUser(user: IUserType){
    this.selectedUserDetailList = this.selectedUserDetailList.filter(s => s.id !== user.id);
    this.onSelectedUserListChange.next(this.selectedUserDetailList);
  }

  @ViewChild(NzSelectComponent, { static: true }) selectNode: NzSelectComponent;

  // 选择发生改变
  public onSelectChange() {
    if (this.selectModel.isNew) {
      const { name } = this.selectModel;
      this.envUserService.upsert({userKeyId: name, userName: name}).subscribe((user) => {
        this.selectedUserDetailList = [...this.selectedUserDetailList, {...user}];
        this.onSelectedUserListChange.next(this.selectedUserDetailList);
        this.selectNode.writeValue(undefined);
      }, _ => this.msg.error('创建用户失败，请重试！'));
    } else {
      this.selectedUserDetailList = [...this.selectedUserDetailList, {...this.selectModel}];
      this.onSelectedUserListChange.next(this.selectedUserDetailList);
      this.selectNode.writeValue(undefined);
    }
  }

  editModalVisible: boolean = false;
  currentEditingUser: IUserType = {} as IUserType;
  saving: boolean = false;
  closeEditModal() {
    this.editModalVisible = false;
    this.currentEditingUser  = {} as IUserType;
  }

  openEditModal(user: IUserType) {
    this.editModalVisible = true;
    this.currentEditingUser = {...user};
  }

  save() {
    this.saving = true;
    const { keyId, name, country, email, customizedProperties } = this.currentEditingUser;

    this.envUserService.upsert({userKeyId: keyId, userName: name, email, country, customizedProperties }).subscribe((user) => {
      this.selectedUserDetailList = this.selectedUserDetailList.map(s => s.keyId === user.keyId ? {...user} : s);
      this.saving = false;
      this.closeEditModal();
    }, _ => {
      this.msg.error('保存用户失败，请重试！');
      this.saving = false;
      this.closeEditModal();
    });
  }
}
