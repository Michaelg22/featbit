import {Component, OnDestroy, OnInit} from '@angular/core';
import {Router} from '@angular/router';
import {NzMessageService} from 'ng-zorro-antd/message';
import {Subject} from 'rxjs';
import {debounceTime, distinctUntilChanged} from 'rxjs/operators';
import {AuditLogService} from "@services/audit-log.service";
import {MemberService} from "@services/member.service";
import {IMember, IMemberListModel, MemberFilter} from "@features/safe/iam/types/member";
import {SegmentService} from "@services/segment.service";
import {EnvUserService} from "@services/env-user.service";
import {AuditLogListFilter, IAuditLog, IAuditLogListModel, RefTypeEnum} from "@core/components/audit-log/types";

@Component({
  selector: 'auditlogs-index',
  templateUrl: './index.component.html',
  styleUrls: ['./index.component.less']
})
export class IndexComponent implements OnInit, OnDestroy {
  private destory$: Subject<void> = new Subject();

  auditLogs: IAuditLog[] = [];

  groupedAuditLogs: {key: string, items: IAuditLog[]}[] = [];

  memberListModel: IMemberListModel = {
    items: [],
    totalCount: 0
  }

  loading: boolean = true;
  membersLoading: boolean = false;
  refTypeFlag: RefTypeEnum = RefTypeEnum.Flag;
  totalCount: number = 0;

  loadAuditLogList() {
    this.loading = true;
    this.auditLogService
      .getList(this.auditLogFilter)
      .subscribe((auditLogs: IAuditLogListModel) => {
        this.totalCount = auditLogs.totalCount;

        if (this.auditLogFilter.pageIndex === 1) {
          this.auditLogs = auditLogs.items;
        } else {
          this.auditLogs = [...this.auditLogs, ...auditLogs.items];
        }

        this.groupedAuditLogs = this.auditLogs
          .map((auditLog) => ({...auditLog, createdDateStr: auditLog.createdAt.slice(0,10)}))
          .sort((auditLog) => new Date(auditLog.createdAt).getTime())
          .reduce((acc, cur) => {
            let auditLogsByDate = acc.find((itm) => itm.key === cur.createdDateStr);
            if (auditLogsByDate) {
              auditLogsByDate.items = [...auditLogsByDate.items, cur];
            } else {
              auditLogsByDate = [cur];
              acc = [...acc, { key: cur.createdDateStr, items: auditLogsByDate }];
            }

            return acc;
          }, []);

        this.loading = false;
      });
  }

  loadMoreAuditLogs() {
    this.auditLogFilter.pageIndex++;

    this.loadAuditLogList();
  }

  loadMemberList(query?: string) {
    this.membersLoading = true;
    this.memberService.getList(new MemberFilter(query ?? '')).subscribe({
      next: (members) => {
        this.memberListModel = members;
        this.membersLoading = false;
      },
      error: () => {
        this.msg.error($localize `:@@auditlogs.idx.failed-to-load-members:Failed to load team members`);
        this.membersLoading = false;
      }
    })
  }

  auditLogFilter: AuditLogListFilter = new AuditLogListFilter();

  private $search: Subject<void> = new Subject();
  private $memberSearch = new Subject<any>();

  onSearch(resetPage?: boolean) {
    if (resetPage) {
      this.auditLogFilter.pageIndex = 1;
    }
    this.$search.next();
  }

  public onMemberSearch(value: string = '') {
    this.membersLoading = true;
    this.$memberSearch.next(value);
  }

  onDateRangeChange(result: Date[]): void {
    this.auditLogFilter.pageIndex = 1;
    this.$search.next();
  }

  constructor(
    private router: Router,
    private auditLogService: AuditLogService,
    private memberService: MemberService,
    private segmentService: SegmentService,
    private envUserService: EnvUserService,
    private msg: NzMessageService,
  ) {
  }

  ngOnInit(): void {
    this.$memberSearch.pipe(
      debounceTime(500),
      distinctUntilChanged()
    ).subscribe(e => {
      this.loadMemberList(e);
    });

    this.$search.pipe(
      debounceTime(400)
    ).subscribe(() => {
      this.loadAuditLogList();
    });

    this.$search.next();
  }

  ngOnDestroy(): void {
    this.destory$.next();
    this.destory$.complete();
  }

  getMemberLabel(member: IMember): string {
    let label = member.email;

    if (member.name?.length > 0) {
      label += ` (${member.name})`;
    }

    return label;
  }
}
