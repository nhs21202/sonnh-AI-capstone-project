import { useCallback, useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  Page,
  Card,
  IndexTable,
  IndexFilters,
  useSetIndexFiltersMode,
  ChoiceList,
  Badge,
  Button,
  BlockStack,
  InlineStack,
  Text,
  Banner,
  Spinner,
  Pagination,
  EmptyState,
} from "@shopify/polaris";
import { useAppBridge } from "@shopify/app-bridge-react";
import { fetchBars, applyToggle } from "../store/announcementBarSlice";
import { barsRepo } from "../api/AnnouncementBarRepository";
import { Toggle } from "../components/Toggle";
import type { RootState, AppDispatch } from "../store/store";
import type { Bar, BarInput } from "../types";

const PAGE_SIZE = 10;

// Build the full payload PUT expects, flipping `enabled`. The server enforces one-active-per-shop.
function toInput(bar: Bar, enabled: boolean): BarInput {
  return {
    title: bar.title,
    enabled,
    message: bar.message,
    background_color: bar.background_color,
    text_color: bar.text_color,
    countdown_enabled: bar.countdown_enabled,
    countdown_end_at: bar.countdown_end_at,
    countdown_bg_color: bar.countdown_bg_color,
    countdown_text_color: bar.countdown_text_color,
    countdown_format: bar.countdown_format,
  };
}

function errMessage(e: unknown): string {
  const x = e as { response?: { data?: { msg?: string } }; message?: string };
  return x?.response?.data?.msg ?? x?.message ?? "Something went wrong.";
}

function fmtEnd(bar: Bar): string {
  if (!bar.countdown_enabled || !bar.countdown_end_at) return "—";
  return new Date(bar.countdown_end_at).toLocaleString();
}

const sortOptions: { label: string; value: `${string} asc` | `${string} desc`; directionLabel: string }[] = [
  { label: "Title", value: "title asc", directionLabel: "A–Z" },
  { label: "Title", value: "title desc", directionLabel: "Z–A" },
  { label: "Status", value: "status asc", directionLabel: "Active first" },
  { label: "Status", value: "status desc", directionLabel: "Draft first" },
  { label: "Countdown end", value: "countdown asc", directionLabel: "Soonest" },
  { label: "Countdown end", value: "countdown desc", directionLabel: "Latest" },
];

export function BarsList({ onAdd, onEdit }: { onAdd: () => void; onEdit: (bar: Bar) => void }) {
  const dispatch = useDispatch<AppDispatch>();
  const { items, total, totalPages, loading, error } = useSelector((s: RootState) => s.bars);
  const shopify = useAppBridge() as unknown as { toast: { show: (m: string, o?: { isError?: boolean }) => void } };
  const [toggleError, setToggleError] = useState<string | null>(null);

  // Search / filter / sort / pagination state. Search is debounced into `debouncedQuery` so typing
  // doesn't fire a request per keystroke; filtering/sorting/paginating all happen on the server.
  const [queryValue, setQueryValue] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [sortSelected, setSortSelected] = useState<string[]>(["title asc"]);
  const { mode, setMode } = useSetIndexFiltersMode();
  const [page, setPage] = useState(1);

  const sort = sortSelected[0] ?? "title asc";

  // Debounce the search box; a new term always returns to page 1.
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedQuery(queryValue);
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [queryValue]);

  // Single source of truth for the current query, so the fetch effect and manual reloads agree.
  const reload = useCallback(() => {
    dispatch(fetchBars({ q: debouncedQuery, status: statusFilter, sort, page, pageSize: PAGE_SIZE }));
  }, [dispatch, debouncedQuery, statusFilter, sort, page]);

  // Fetch a page from the server whenever any list parameter changes (incl. on mount).
  useEffect(() => {
    reload();
  }, [reload]);

  // If the current page no longer exists (e.g. the last row on a page was deleted), step back.
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  async function handleDelete(id: number) {
    await barsRepo.remove(id);
    reload();
    shopify.toast.show("Bar deleted");
  }

  // Activate/deactivate straight from the list. The UI flips instantly (optimistic) — no full-list
  // reload on success; a refetch only runs on error to revert to server truth.
  async function handleToggle(bar: Bar) {
    const next = !bar.enabled;
    setToggleError(null);
    dispatch(applyToggle({ id: bar.id, enabled: next }));
    try {
      await barsRepo.update(bar.id, toInput(bar, next));
      shopify.toast.show(next ? "Bar activated" : "Bar deactivated");
    } catch (e) {
      reload();
      setToggleError(`Couldn't ${next ? "activate" : "deactivate"} “${bar.title}”: ${errMessage(e)}`);
    }
  }

  const filters = [
    {
      key: "status",
      label: "Status",
      filter: (
        <ChoiceList
          title="Status"
          titleHidden
          choices={[
            { label: "Active", value: "active" },
            { label: "Draft", value: "draft" },
          ]}
          selected={statusFilter}
          onChange={(v) => {
            setStatusFilter(v);
            setPage(1);
          }}
          allowMultiple
        />
      ),
      shortcut: true,
    },
  ];
  const clearStatus = () => {
    setStatusFilter([]);
    setPage(1);
  };
  const appliedFilters = statusFilter.length
    ? [
        {
          key: "status",
          label: `Status: ${statusFilter.map((s) => (s === "active" ? "Active" : "Draft")).join(", ")}`,
          onRemove: clearStatus,
        },
      ]
    : [];

  const rows = items.map((bar, index) => (
    <IndexTable.Row id={String(bar.id)} key={bar.id} position={index}>
      <IndexTable.Cell>
        <Text as="span" fontWeight="semibold">
          {bar.title}
        </Text>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <InlineStack gap="200" blockAlign="center">
          <Toggle
            checked={bar.enabled}
            onChange={() => handleToggle(bar)}
            label={`${bar.enabled ? "Deactivate" : "Activate"} ${bar.title}`}
          />
          {bar.enabled ? <Badge tone="success">Active</Badge> : <Badge>Draft</Badge>}
        </InlineStack>
      </IndexTable.Cell>
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

  const hasFilters = debouncedQuery.trim() !== "" || statusFilter.length > 0;
  const clearAll = () => {
    setStatusFilter([]);
    setQueryValue("");
    setPage(1);
  };
  const emptyStateImage = "https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png";
  const emptyMarkup =
    total === 0 && !hasFilters ? (
      <EmptyState heading="Create your first announcement bar" action={{ content: "Add bar", onAction: onAdd }} image={emptyStateImage}>
        <p>Show a message or countdown at the top of your storefront.</p>
      </EmptyState>
    ) : (
      <EmptyState
        heading="No bars match your search or filters"
        action={{ content: "Clear filters", onAction: clearAll }}
        image={emptyStateImage}
      >
        <p>Try a different search term or remove the filters.</p>
      </EmptyState>
    );

  return (
    <Page
      fullWidth
      title="Announcement bars"
      subtitle="Create and manage your bars. Only one bar can be active at a time — the active bar is what visitors see on your storefront."
      primaryAction={{ content: "Add bar", onAction: onAdd }}
    >
      <BlockStack gap="300">
        {error && <Banner tone="critical">{error}</Banner>}
        {toggleError && (
          <Banner tone="critical" onDismiss={() => setToggleError(null)}>
            {toggleError}
          </Banner>
        )}
        <Card padding="0">
          {loading ? (
            <div style={{ padding: 16 }}>
              <Spinner size="small" />
            </div>
          ) : (
            <>
              <IndexFilters
                queryValue={queryValue}
                queryPlaceholder="Search by title or message"
                onQueryChange={setQueryValue}
                onQueryClear={() => setQueryValue("")}
                sortOptions={sortOptions}
                sortSelected={sortSelected}
                onSort={(v) => {
                  setSortSelected(v);
                  setPage(1);
                }}
                filters={filters}
                appliedFilters={appliedFilters}
                onClearAll={clearAll}
                mode={mode}
                setMode={setMode}
                tabs={[]}
                selected={0}
                onSelect={() => {}}
                canCreateNewView={false}
              />
              <IndexTable
                resourceName={{ singular: "bar", plural: "bars" }}
                itemCount={items.length}
                selectable={false}
                emptyState={emptyMarkup}
                headings={[
                  { title: "Title" },
                  { title: "Status" },
                  { title: "Countdown end" },
                  { title: "Message preview" },
                  { title: "Actions" },
                ]}
              >
                {rows}
              </IndexTable>
              {totalPages > 1 && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "flex-end",
                    padding: "12px 16px",
                    borderTop: "1px solid #e1e3e5",
                  }}
                >
                  <Pagination
                    hasPrevious={page > 1}
                    onPrevious={() => setPage((p) => Math.max(1, p - 1))}
                    hasNext={page < totalPages}
                    onNext={() => setPage((p) => Math.min(totalPages, p + 1))}
                    label={`Page ${page} of ${totalPages}`}
                  />
                </div>
              )}
            </>
          )}
        </Card>
      </BlockStack>
    </Page>
  );
}
