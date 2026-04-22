// file location: src/components/page-ui/parts/parts-deliveries-ui.js

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
    color: "var(--primary-dark)"
  }}>
          You do not have access to delivery planning.
        </div>
      </>; // render extracted page section.

    case "section2":
      return <>
      <div style={pageStyles.container}>
        <section className="app-section-card" style={pageStyles.headerCard}>
          <div style={{
        display: "flex",
        flexDirection: "column",
        gap: "6px"
      }}>
            <p style={{
          margin: 0,
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          color: "var(--primary-dark)",
          fontSize: "0.85rem"
        }}>
              Driver view
            </p>
            <h1 style={{
          margin: 0,
          color: "var(--primary)"
        }}>Parts deliveries</h1>
            <p style={{
          margin: 0,
          color: "var(--info)"
        }}>
              Quickly review today&rsquo;s drop offs, mark jobs as delivered, and reorder the list for the van.
            </p>
          </div>

          <div style={pageStyles.controls}>
            <div>
              <div style={{
            fontSize: "0.9rem",
            fontWeight: 600,
            color: "var(--primary-dark)"
          }}>Selected day</div>
              <div style={{
            fontSize: "1.1rem",
            fontWeight: 600
          }}>{formatIsoDate(selectedDate)}</div>
            </div>
            <div style={pageStyles.dateControls}>
              <button type="button" onClick={() => setSelectedDate(prev => adjustIsoDate(prev, -1))} style={{
            borderRadius: "var(--radius-sm)",
            border: "none",
            background: "var(--surface)",
            color: "var(--primary-dark)",
            padding: "var(--control-padding)",
            cursor: "pointer",
            fontWeight: 600
          }}>
                Previous day
              </button>
              <CalendarField value={selectedDate} onChange={value => setSelectedDate(value)} name="selectedDate" />
              <button type="button" onClick={() => setSelectedDate(prev => adjustIsoDate(prev, 1))} style={{
            borderRadius: "var(--radius-sm)",
            border: "none",
            background: "var(--primary-dark)",
            color: "var(--surface)",
            padding: "var(--control-padding)",
            cursor: "pointer",
            fontWeight: 600
          }}>
                Next day
              </button>
            </div>
          </div>

          <div style={{
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
          </div>
        </section>

        <section className="app-section-card" style={pageStyles.listCard}>
          <div style={{
        display: "flex",
        flexDirection: "column",
        gap: "4px"
      }}>
            <h2 style={{
          margin: 0,
          color: "var(--primary-dark)"
        }}>Delivery list</h2>
            <p style={{
          margin: 0,
          color: "var(--grey-accent-dark)"
        }}>
              Tap a job to view invoice details. Use the arrows to change the drive order.
            </p>
          </div>
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
        }).map((_, i) => <div key={i} style={{
          display: "grid",
          gridTemplateColumns: "36px 1fr auto",
          gap: 12,
          padding: 12,
          borderRadius: "var(--radius-md)",
          background: "var(--surface)"
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
                </div>)}
            </div>}
          {!loading && sortedJobs.length === 0 && <div style={{
        color: "var(--info)"
      }}>No deliveries queued for this day.</div>}
          {!loading && sortedJobs.map((job, index) => <DeliveryJobRow key={job.id} job={job} index={index} total={sortedJobs.length} onView={setViewJob} onMove={handleMoveJob} onMarkDelivered={handleMarkDelivered} actionDisabled={rowActionId === job.id} />)}
        </section>
      </div>
      {viewJob && <DeliveryJobViewModal job={viewJob} onClose={() => setViewJob(null)} />}
    </>; // render extracted page section.
    default:
      return null; // keep unknown sections visually empty.
  }
}
