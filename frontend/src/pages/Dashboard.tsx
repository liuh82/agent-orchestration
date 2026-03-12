import { Card, Row, Col, Statistic, Progress } from 'antd';
import { useQuery } from 'react-query';
import { DashboardOutlined, TeamOutlined, ProjectOutlined, AppstoreOutlined } from '@ant-design/icons';
import { useAgentsStore } from '../stores/agents';
import { useTasksStore } from '../stores/tasks';

export const DashboardPage = () => {
  const { fetchAgents, agents } = useAgentsStore();
  const { fetchTasks, tasks } = useTasksStore();

  useQuery('agents', fetchAgents);
  useQuery('tasks', fetchTasks);

  const totalAgents = agents.length;
  const onlineAgents = agents.filter(a => a.status === 'online').length;
  const busyAgents = agents.filter(a => a.status === 'busy').length;

  const totalTasks = tasks.length;
  const completedTasks = tasks.filter(t => t.status === 'completed').length;
  const runningTasks = tasks.filter(t => t.status === 'running').length;
  const failedTasks = tasks.filter(t => t.status === 'failed').length;

  const taskCompletionRate = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

  return (
    <div>
      <h1 style={{ marginBottom: 24 }}>仪表板</h1>

      <Row gutter={[24, 24]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="总 Agent 数"
              value={totalAgents}
              prefix={<TeamOutlined />}
            />
            <div style={{ marginTop: 12 }}>
              <Progress
                percent={(onlineAgents / totalAgents) * 100}
                status="success"
                strokeColor="#52c41a"
              />
              <div style={{ marginTop: 4, color: '#666', fontSize: 12 }}>
                在线: {onlineAgents} | 忙碌: {busyAgents}
              </div>
            </div>
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="任务统计"
              value={totalTasks}
              prefix={<ProjectOutlined />}
            />
            <div style={{ marginTop: 12 }}>
              <Row>
                <Col span={8}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ color: '#1890ff', fontSize: 24 }}>{runningTasks}</div>
                    <div style={{ color: '#666', fontSize: 12 }}>运行中</div>
                  </div>
                </Col>
                <Col span={8}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ color: '#52c41a', fontSize: 24 }}>{completedTasks}</div>
                    <div style={{ color: '#666', fontSize: 12 }}>已完成</div>
                  </div>
                </Col>
                <Col span={8}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ color: '#ff4d4f', fontSize: 24 }}>{failedTasks}</div>
                    <div style={{ color: '#666', fontSize: 12 }}>失败</div>
                  </div>
                </Col>
              </Row>
            </div>
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="任务完成率"
              value={taskCompletionRate}
              precision={2}
              suffix="%"
              prefix={<AppstoreOutlined />}
            />
            <Progress percent={taskCompletionRate} style={{ marginTop: 8 }} />
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Agent 使用率"
              value={(busyAgents / totalAgents) * 100}
              precision={2}
              suffix="%"
              prefix={<DashboardOutlined />}
            />
            <Progress percent={(busyAgents / totalAgents) * 100} status="active" />
          </Card>
        </Col>
      </Row>

      <Row gutter={[24, 24]}>
        <Col xs={24} lg={16}>
          <Card title="最近任务">
            {/* TODO: 显示最近任务列表 */}
            <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>
              任务列表功能待实现
            </div>
          </Card>
        </Col>

        <Col xs={24} lg={8}>
          <Card title="系统状态">
            <div style={{ padding: '20px 0' }}>
              <div style={{ marginBottom: 16 }}>
                <div style={{ marginBottom: 8 }}>数据库连接</div>
                <Progress percent={100} status="success" />
              </div>
              <div style={{ marginBottom: 16 }}>
                <div style={{ marginBottom: 8 }}>工作流引擎</div>
                <Progress percent={100} status="success" />
              </div>
              <div style={{ marginBottom: 16 }}>
                <div style={{ marginBottom: 8 }}>外部服务</div>
                <Progress percent={85} status="normal" />
              </div>
            </div>
          </Card>
        </Col>
      </Row>
    </div>
  );
};