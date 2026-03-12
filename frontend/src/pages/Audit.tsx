import { useEffect, useState } from 'react';
import {
  Card, Table, Button, Space, message, DatePicker,
  Select, Input, Row, Col, Statistic, Tag, Empty,
  Drawer, Descriptions, Collapse
} from 'antd';
import {
  ExportOutlined, SearchOutlined, FilterOutlined,
  EyeOutlined, FileTextOutlined, ClockCircleOutlined
} from '@ant-design/icons';
import { useOrgStore } from '../stores/org';
import { AuditLog } from '../types';
import dayjs from 'dayjs';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';

const { Option } = Select;
const { RangePicker } = DatePicker;
const { Panel } = Collapse;

export const AuditPage = () => {
  const {
    auditLogs,
    auditSummary,
    fetchAuditLogs,
    fetchAuditSummary,
    loading
  } = useOrgStore();

  const [filters, setFilters] = useState<any>({});
  const [detailDrawerVisible, setDetailDrawerVisible] = useState(false);
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  useEffect(() => {
    fetchAuditLogs({ page: 1, pageSize: 50 });
    fetchAuditSummary();
  }, []);

  const handleSearch = () => {
    fetchAuditLogs({
      ...filters,
      startTime: filters.dateRange?.[0]?.format('YYYY-MM-DD HH:mm:ss'),
      endTime: filters.dateRange?.[1]?.format('YYYY-MM-DD HH:mm:ss'),
    });
  };

  const handleReset = () => {
    setFilters({});
    fetchAuditLogs({ page: 1, pageSize: 50 });
  };

  const handleExportExcel = () => {
    try {
      const ws = XLSX.utils.json_to_sheet(auditLogs);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'AuditLogs');
      XLSX.writeFile(wb, `audit_logs_${Date.now()}.xlsx`);
      message.success('导出成功');
    } catch (error) {
      message.error('导出失败');
    }
  };

  const showDetail = (log: AuditLog) => {
    setSelectedLog(log);
    setDetailDrawerVisible(true);
  };

  const getActionColor = (action: string) => {
    if (action.includes('create') || action.includes('execute')) return 'green';
    if (action.includes('update')) return 'blue';
    if (action.includes('delete')) return 'red';
    return 'default';
  };

  const getTypeColor = (type: string) => {
    const colorMap: Record<string, string> = {
      create: 'green',
      update: 'blue',
      delete: 'red',
      read: 'default',
      execute: 'purple',
      approve: 'cyan',
      reject: 'orange',
    };
    return colorMap[type] || 'default';
  };

  const columns = [
    {
      title: '时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 150,
      render: (date: string) => dayjs(date).format('YYYY-MM-DD HH:mm:ss'),
    },
    {
      title: '操作类型',
      dataIndex: 'type',
      key: 'type',
      width: 80,
      render: (type: string) => <Tag color={getTypeColor(type)}>{type}</Tag>,
    },
    {
      title: '操作',
      dataIndex: 'action',
      key: 'action',
      width: 150,
      render: (action: string) => <Tag color={getActionColor(action)}>{action}</Tag>,
    },
    {
      title: '资源类型',
      dataIndex: 'resourceType',
      key: 'resourceType',
    },
    {
      title: '资源ID',
      dataIndex: 'resourceId',
      key: 'resourceId',
      ellipsis: true,
    },
    {
      title: '用户',
      dataIndex: 'userName',
      key: 'userName',
    },
    {
      title: '状态码',
      dataIndex: 'statusCode',
      key: 'statusCode',
      render: (code: number) => (
        <Tag color={code >= 200 && code < 300 ? 'green' : 'red'}>
          {code}
        </Tag>
      ),
    },
    {
      title: '耗时(ms)',
      dataIndex: 'durationMs',
      key: 'durationMs',
      render: (duration: number | null) => duration || '-',
    },
    {
      title: '操作',
      key: 'action',
      width: 80,
      render: (_: unknown, record: AuditLog) => (
        <Button
          type="link"
          size="small"
          icon={<EyeOutlined />}
          onClick={() => showDetail(record)}
        >
          详情
        </Button>
      ),
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>审计日志</h1>
        <Button type="primary" icon={<ExportOutlined />} onClick={handleExportExcel}>
          导出Excel
        </Button>
      </div>

      {/* 统计卡片 */}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="总记录数"
              value={auditLogs.length}
              prefix={<FileTextOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="成功数"
              value={auditLogs.filter(l => l.statusCode >= 200 && l.statusCode < 300).length}
              prefix={<CheckCircleOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="失败数"
              value={auditLogs.filter(l => l.statusCode >= 400).length}
              prefix={<CloseCircleOutlined />}
              valueStyle={{ color: '#ff4d4f' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="平均耗时"
              value={auditLogs.length > 0
                ? Math.round(auditLogs.reduce((sum, l) => sum + (l.durationMs || 0), 0) / auditLogs.length)
                : 0
              }
              suffix="ms"
              prefix={<ClockCircleOutlined />}
              valueStyle={{ color: '#722ed1' }}
            />
          </Card>
        </Col>
      </Row>

      <Card>
        {/* 筛选栏 */}
        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col span={6}>
            <Input
              placeholder="搜索用户名或资源ID"
              prefix={<SearchOutlined />}
              onChange={(e) => setFilters({ ...filters, keyword: e.target.value })}
            />
          </Col>
          <Col span={6}>
            <RangePicker
              style={{ width: '100%' }}
              ranges={{
                '今天': [dayjs().startOf('day'), dayjs().endOf('day')],
                '本周': [dayjs().startOf('week'), dayjs().endOf('week')],
                '本月': [dayjs().startOf('month'), dayjs().endOf('month')],
              }}
              onChange={(dates) => setFilters({ ...filters, dateRange: dates })}
            />
          </Col>
          <Col span={4}>
            <Select
              placeholder="操作类型"
              allowClear
              onChange={(value) => setFilters({ ...filters, type: value })}
            >
              <Option value="create">创建</Option>
              <Option value="update">更新</Option>
              <Option value="delete">删除</Option>
              <Option value="execute">执行</Option>
            </Select>
          </Col>
          <Col span={4}>
            <Select
              placeholder="资源类型"
              allowClear
              onChange={(value) => setFilters({ ...filters, resourceType: value })}
            >
              <Option value="agent">Agent</Option>
              <Option value="task">Task</Option>
              <Option value="workflow">Workflow</Option>
              <Option value="cost">Cost</Option>
              <Option value="goal">Goal</Option>
              <Option value="approval">Approval</Option>
            </Select>
          </Col>
          <Col span={4}>
            <Space>
              <Button type="primary" icon={<FilterOutlined />} onClick={handleSearch}>
                搜索
              </Button>
              <Button onClick={handleReset}>重置</Button>
            </Space>
          </Col>
        </Row>

        <Table
          columns={columns}
          dataSource={auditLogs}
          rowKey="id"
          loading={loading}
          pagination={{
            pageSize: 50,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total) => `共 ${total} 条`,
          }}
          expandable={{
            expandedRowRender: (record: AuditLog) => (
              <Card size="small" style={{ margin: 0 }}>
                <Descriptions column={2} size="small">
                  <Descriptions.Item label="IP地址">{record.ipAddress || '-'}</Descriptions.Item>
                  <Descriptions.Item label="User Agent">
                    <div style={{ maxWidth: 300, wordBreak: 'break-all' }}>
                      {record.userAgent || '-'}
                    </div>
                  </Descriptions.Item>
                  <Descriptions.Item label="请求参数">
                    <Collapse ghost size="small">
                      <Panel header="查看" key="request">
                        <pre style={{ fontSize: 12, maxHeight: 200, overflow: 'auto' }}>
                          {record.requestData || '-'}
                        </pre>
                      </Panel>
                    </Collapse>
                  </Descriptions.Item>
                  <Descriptions.Item label="响应结果">
                    <Collapse ghost size="small">
                      <Panel header="查看" key="response">
                        <pre style={{ fontSize: 12, maxHeight: 200, overflow: 'auto' }}>
                          {record.responseData || '-'}
                        </pre>
                      </Panel>
                    </Collapse>
                  </Descriptions.Item>
                </Descriptions>
              </Card>
            ),
          }}
          locale={{
            emptyText: <Empty description="暂无审计日志" />
          }}
        />
      </Card>

      {/* 详情抽屉 */}
      <Drawer
        title="审计日志详情"
        placement="right"
        onClose={() => setDetailDrawerVisible(false)}
        open={detailDrawerVisible}
        width={600}
      >
        {selectedLog && (
          <div>
            <Descriptions column={1} bordered>
              <Descriptions.Item label="ID">{selectedLog.id}</Descriptions.Item>
              <Descriptions.Item label="时间">{dayjs(selectedLog.createdAt).format('YYYY-MM-DD HH:mm:ss')}</Descriptions.Item>
              <Descriptions.Item label="操作类型">
                <Tag color={getTypeColor(selectedLog.type)}>{selectedLog.type}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="操作">
                <Tag color={getActionColor(selectedLog.action)}>{selectedLog.action}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="资源类型">{selectedLog.resourceType}</Descriptions.Item>
              <Descriptions.Item label="资源ID">{selectedLog.resourceId}</Descriptions.Item>
              <Descriptions.Item label="用户ID">{selectedLog.userId}</Descriptions.Item>
              <Descriptions.Item label="用户名">{selectedLog.userName}</Descriptions.Item>
              <Descriptions.Item label="部门ID">{selectedLog.departmentId || '-'}</Descriptions.Item>
              <Descriptions.Item label="IP地址">{selectedLog.ipAddress || '-'}</Descriptions.Item>
              <Descriptions.Item label="状态码">
                <Tag color={selectedLog.statusCode >= 200 && selectedLog.statusCode < 300 ? 'green' : 'red'}>
                  {selectedLog.statusCode}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="耗时">{selectedLog.durationMs || '-'} ms</Descriptions.Item>
              {selectedLog.errorMessage && (
                <Descriptions.Item label="错误信息" labelStyle={{ color: 'red' }}>
                  {selectedLog.errorMessage}
                </Descriptions.Item>
              )}
            </Descriptions>

            <div style={{ marginTop: 16 }}>
              <h4>请求参数</h4>
              <pre style={{
                background: '#f5f5f5',
                padding: 12,
                borderRadius: 4,
                maxHeight: 200,
                overflow: 'auto',
                fontSize: 12
              }}>
                {selectedLog.requestData || '-'}
              </pre>
            </div>

            <div style={{ marginTop: 16 }}>
              <h4>响应结果</h4>
              <pre style={{
                background: '#f5f5f5',
                padding: 12,
                borderRadius: 4,
                maxHeight: 200,
                overflow: 'auto',
                fontSize: 12
              }}>
                {selectedLog.responseData || '-'}
              </pre>
            </div>
          </div>
        )}
      </Drawer>
    </div>
  );
};
