---
articleId: lab-code
slug: lab-code
title: 把一周的阅读记成一张表
description: 同一组书名、页数和日期，在八种语言之间传递。
publishedAt: '2026-11-24'
category: engineering
tags: [代码, 阅读记录]
status: published
---

我想知道晚上读的二十页究竟去了哪里，便把每天最后合上的那本书记下来。只需三列，过一周就有了值得翻看的东西。

## 录入两晚的数据

把下面的 JSON 存作 `reading.json`。日期用同一种写法，排序时就不用另备一列。

```json
[
  { "date": "2026-11-18", "title": "山窗小记", "pages": 18 },
  { "date": "2026-11-19", "title": "山窗小记", "pages": 24 }
]
```

### 用 Python 汇总

第一天的折角落在十八页，第二天的最后一页恰好是一个章节的结尾。把页数加在一起，就是这一周已读的四十二页。

```python
import json
from pathlib import Path

entries = json.loads(Path("reading.json").read_text(encoding="utf-8"))
print(sum(entry["pages"] for entry in entries))
```

### 从终端核对原始记录

```bash
python3 -m json.tool reading.json
```

## 留给数据库的两行

```sql
WITH reading(day, title, pages) AS (
  VALUES ('2026-11-18', '山窗小记', 18),
         ('2026-11-19', '山窗小记', 24)
)
SELECT title, SUM(pages) AS total_pages
FROM reading
GROUP BY title;
```

## 把笔记排回网页

### 给总数一个类型

```typescript
type Reading = { date: string; title: string; pages: number };

function totalPages(entries: readonly Reading[]): number {
  return entries.reduce((total, entry) => total + entry.pages, 0);
}
```

### 排一行能单独复制的 HTML

这一行故意保持完整，窄屏上可以在代码框内横向读完属性和值。

```html
<output class="weekly-pages" data-first-day="2026-11-18" data-last-day="2026-11-19" aria-label="山窗小记本周阅读页数">42 页</output>
```

### 为数字留出相同宽度

```css
.weekly-pages {
  font-variant-numeric: tabular-nums;
  padding-inline: 0.5em;
}
```

## 记下这一周的口径

```yaml
week:
  first_day: 2026-11-18
  last_day: 2026-11-19
  unit: 页
  count_rereading: true
```

重读的一页也算一页。下周如果换了想法，就在新的周记旁再写一句。
