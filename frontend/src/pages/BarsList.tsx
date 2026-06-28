import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Page, Card, IndexTable, Badge, Button, BlockStack, InlineStack, Text, Banner, Spinner } from "@shopify/polaris";
import { fetchBars } from "../store/announcementBarSlice";
import { barsRepo } from "../api/AnnouncementBarRepository";
import type { RootState, AppDispatch } from "../store/store";
import type { Bar } from "../types";

function fmtEnd(bar: Bar): string {
  if (!bar.countdown_enabled || !bar.countdown_end_at) return "—";
  return new Date(bar.countdown_end_at).toLocaleString();
}

export function BarsList({ onAdd, onEdit }: { onAdd: () => void; onEdit: (bar: Bar) => void }) {
  const dispatch = useDispatch<AppDispatch>();
  const { items, loading, error } = useSelector((s: RootState) => s.bars);

  useEffect(() => {
    dispatch(fetchBars());
  }, [dispatch]);

  const activeCount = items.filter((b) => b.enabled).length;

  async function handleDelete(id: number) {
    await barsRepo.remove(id);
    dispatch(fetchBars());
  }

  const rows = items.map((bar, index) => (
    <IndexTable.Row id={String(bar.id)} key={bar.id} position={index}>
      <IndexTable.Cell>
        <Text as="span" fontWeight="semibold">
          {bar.title}
        </Text>
      </IndexTable.Cell>
      <IndexTable.Cell>{bar.enabled ? <Badge tone="success">Active</Badge> : <Badge>Draft</Badge>}</IndexTable.Cell>
      <IndexTable.Cell>
        <Text as="span" tone={bar.countdown_enabled && bar.countdown_end_at ? undefined : "subdued"}>
          {fmtEnd(bar)}
        </Text>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Text as="span" tone="subdued" truncate>
          {bar.message}
        </Text>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <InlineStack gap="200">
          <Button size="slim" onClick={() => onEdit(bar)}>
            Edit
          </Button>
          <Button size="slim" variant="plain" tone="critical" onClick={() => handleDelete(bar.id)}>
            Delete
          </Button>
        </InlineStack>
      </IndexTable.Cell>
    </IndexTable.Row>
  ));

  return (
    <Page
      fullWidth
      title="Announcement bars"
      subtitle="Create and manage your bars. Only one bar can be active at a time — the active bar is what visitors see on your storefront."
      primaryAction={{ content: "Add bar", onAction: onAdd }}
    >
      <BlockStack gap="300">
        {error && <Banner tone="critical">{error}</Banner>}
        <Card padding="0">
          <div style={{ padding: "12px 16px", display: "flex", alignItems: "center", gap: 12, borderBottom: "1px solid #e1e3e5" }}>
            <Text as="h3" variant="headingSm">
              Saved bars
            </Text>
            <Badge>{`${items.length} bars`}</Badge>
            <div style={{ flex: 1 }} />
            <Text as="span" tone="subdued">{`${activeCount} active`}</Text>
          </div>
          {loading ? (
            <div style={{ padding: 16 }}>
              <Spinner size="small" />
            </div>
          ) : items.length === 0 ? (
            <div style={{ padding: 16 }}>
              <Text as="p" tone="subdued">
                No bars yet. Use “Add bar” to create one.
              </Text>
            </div>
          ) : (
            <IndexTable
              resourceName={{ singular: "bar", plural: "bars" }}
              itemCount={items.length}
              selectable={false}
              headings={[{ title: "Title" }, { title: "Status" }, { title: "Countdown end" }, { title: "Message preview" }, { title: "Actions" }]}
            >
              {rows}
            </IndexTable>
          )}
          <div style={{ padding: "12px 16px", borderTop: "1px solid #e1e3e5" }}>
            <Text as="span" tone="subdued">
              Enabling any bar in the editor automatically turns the others into drafts, so exactly one stays active.
            </Text>
          </div>
        </Card>
      </BlockStack>
    </Page>
  );
}
