// file location: src/components/page-ui/parts/parts-deliveries-ui.js
import LayerSurface from "@/components/ui/LayerSurface"; // canonical layer primitive (CLAUDE.md §3.0)
import LayerTheme from "@/components/ui/LayerTheme"; // canonical layer primitive (CLAUDE.md §3.0)
import Button from "@/components/ui/Button";

export default function PartsDeliveriesPageUi(props) {
  const {
    CalendarField,
    DeliveryJobRow,
    DeliveryJobViewModal,
    SkeletonBlock,
    SkeletonKeyframes,
    adjustIsoDate,
    completedCount,
    error,
    formatIsoDate,
    handleMarkDelivered,
    handleMoveJob,
    loading,
    pageStyles,
    pendingCount,
    rowActionId,
    selectedDate,
    setSelectedDate,
    setViewJob,
    sortedJobs,
    viewJob,
  } = props; // receive page logic props.

  switch (props.view) { // choose the page section requested by logic.
    case "section1":
      return <>
        <div style={{
    padding: "48px",
    textAlign: "center",
    color: "var(--primary-selected)"
  }}>
          You do not have access to delivery planning.
        </div>
      </>; // render extracted page section.

    case "section2":
      return <>
      <div style={pageStyles.container}>
        <LayerTheme as="section" sectionKey="parts-deliveries-header" sectionType="content-card" data-dev-text-preview="Driver view header" style={pageStyles.headerCard}>
          <LayerSurface data-dev-section="1" data-dev-section-key="parts-deliveries-controls" data-dev-section-type="toolbar" data-dev-section-parent="parts-deliveries-header" data-dev-text-preview="Day picker controls" style={pageStyles.controls}>
            <div>
              <div style={{
            fontSize: "0.9rem",
            fontWeight: 600,
            color: "var(--primary-selected)"
          }}>Selected day</div>
              <div style={{
            fontSize: "1.1rem",
            fontWeight: 600
          }}>{formatIsoDate(selectedDate)}</div>
            </div>
            <div style={pageStyles.dateControls}>
              <Button variant="secondary" onClick={() => setSelectedDate(prev => adjustIsoDate(prev, -1))}>
                Previous day
              </Button>
              <CalendarField value={selectedDate} onValueChange={value => setSelectedDate(value)} name="selectedDate" />
              <Button variant="primary" onClick={() => setSelectedDate(prev => adjustIsoDate(prev, 1))}>
                Next day
              </Button>
            </div>
          </LayerSurface>

          <LayerSurface data-dev-section="1" data-dev-section-key="parts-deliveries-counts" data-dev-section-type="stat-card" data-dev-section-parent="parts-deliveries-header" data-dev-text-preview="Queued / completed counts" style={{
        display: "flex",
        gap: "20px",
        flexWrap: "wrap"
      }}>
            <div>
              <div style={{
            fontSize: "0.8rem",
            color: "var(--info)"
          }}>Queued jobs</div>
              <strong style={{
            fontSize: "1.6rem"
          }}>{pendingCount}</strong>
            </div>
            <div>
              <div style={{
            fontSize: "0.8rem",
            color: "var(--info)"
          }}>Completed</div>
              <strong style={{
            fontSize: "1.6rem"
          }}>{completedCount}</strong>
            </div>
          </LayerSurface>
        </LayerTheme>

        <LayerTheme as="section" sectionKey="parts-deliveries-list" sectionType="content-card" data-dev-text-preview="Delivery list" style={pageStyles.listCard}>
          <LayerSurface style={{
        display: "flex",
        flexDirection: "column",
        gap: "4px"
      }}>
            <h2 style={{
          margin: 0,
          color: "var(--primary-selected)"
        }}>Delivery list</h2>
            <p style={{
          margin: 0,
          color: "var(--grey-accent-dark)"
        }}>
              Tap a job to view invoice details. Use the arrows to change the drive order.
            </p>
          </LayerSurface>
          {error && <div style={{
        color: "var(--danger)",
        fontWeight: 600
      }}>{error}</div>}
          {loading && <div style={{
        display: "flex",
        flexDirection: "column",
        gap: 10
      }}>
              <SkeletonKeyframes />
              {Array.from({
          length: 4
        }).map((_, i) => <LayerSurface key={i} padding="12px" gap="0" style={{
          display: "grid",
          gridTemplateColumns: "36px 1fr auto",
          gap: 12
        }}>
                  <SkeletonBlock width="28px" height="28px" borderRadius="999px" />
                  <div style={{
            display: "flex",
            flexDirection: "column",
            gap: 6
          }}>
                    <SkeletonBlock width="55%" height="12px" />
                    <SkeletonBlock width="75%" height="10px" />
                  </div>
                  <SkeletonBlock width="56px" height="18px" />
                </LayerSurface>)}
            </div>}
          {!loading && sortedJobs.length === 0 && <div style={{
        color: "var(--info)"
      }}>No deliveries queued for this day.</div>}
          {!loading && sortedJobs.map((job, index) => <DeliveryJobRow key={job.id} job={job} index={index} total={sortedJobs.length} onView={setViewJob} onMove={handleMoveJob} onMarkDelivered={handleMarkDelivered} actionDisabled={rowActionId === job.id} />)}
        </LayerTheme>
      </div>
      {viewJob && <DeliveryJobViewModal job={viewJob} onClose={() => setViewJob(null)} />}
    </>; // render extracted page section.
    default:
      return null; // keep unknown sections visually empty.
  }
}
