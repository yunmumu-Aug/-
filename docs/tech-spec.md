# 时光轴 — 技术规格文档

## 技术栈

| 层级 | 技术 | 版本 | 说明 |
|------|------|------|------|
| 前端框架 | Next.js | 16.x | App Router，React Server Components |
| UI 库 | React | 19.x | 客户端交互 |
| 语言 | TypeScript | 5.x | 类型安全 |
| 样式 | Tailwind CSS | 4.x | 原子化 CSS |
| UI 组件 | shadcn/ui | latest | 可复用组件库 |
| 图表 | Recharts | latest | 饼图、柱状图、折线图 |
| 时间解析 | chrono-node | latest | 自然语言时间识别 |
| 日期工具 | date-fns | latest | 日期计算和格式化 |
| 图标 | lucide-react | latest | 导航和 UI 图标 |
| 数据库 | Supabase | latest | PostgreSQL + Auth + 实时同步 |
| 部署 | Vercel | — | 免费托管 |
| 加密 | Web Crypto API | — | 客户端 AES-256-GCM 加密 |

## 数据库

### 表结构

```sql
-- 用户资料
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  display_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 日记
CREATE TABLE diaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  date DATE NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  content_iv TEXT,
  wake_time TIME,
  sleep_time TIME,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, date)
);

-- 标签
CREATE TABLE tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#3B82F6',
  is_preset BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, name)
);

-- 日记-标签关联
CREATE TABLE diary_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  diary_id UUID REFERENCES diaries(id) ON DELETE CASCADE,
  tag_id UUID REFERENCES tags(id) ON DELETE CASCADE,
  time_label TEXT,
  position INTEGER,
  UNIQUE(diary_id, tag_id, position)
);
```

### Row Level Security

每个表启用 RLS，用户只能访问自己的数据：
```sql
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE diaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE diary_tags ENABLE ROW LEVEL SECURITY;

-- 策略模式：user_id = auth.uid()
```

## 客户端加密方案

日记正文使用 AES-256-GCM 加密：
1. 从用户密码派生加密密钥（PBKDF2）
2. 加密密钥仅存于浏览器内存（sessionStorage）
3. 日记 content 字段存储加密后的 Base64 密文
4. content_iv 字段存储初始向量
5. 标签、时间字段不加密以支持图表查询

## API 路由

| 路由 | 方法 | 说明 |
|------|------|------|
| `/api/diaries` | GET | 获取日记列表 |
| `/api/diaries` | POST | 创建/更新日记 |
| `/api/diaries/[date]` | GET | 获取某天日记 |
| `/api/tags` | GET | 获取用户标签 |
| `/api/tags` | POST | 创建标签 |
| `/api/tags/batch` | POST | 批量导入标签 |
| `/api/tags/[id]` | PUT/DELETE | 编辑/删除标签 |
| `/api/charts/[type]` | GET | 图表数据查询 |

## 项目配置

### 环境变量 (.env.local)
```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```
