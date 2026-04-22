// file location: src/components/page-ui/vhc/customer-preview/vhc-customer-preview-job-number-ui.js

export default function CustomerPreviewPageUi(props) {
  const {
    BrandLogo,
    Head,
    SkeletonBlock,
    SkeletonKeyframes,
    activeTab,
    customerInfo,
    error,
    handleBack,
    jobNumber,
    photoFiles,
    renderPhotosTab,
    renderSummaryTab,
    renderVideosTab,
    setActiveTab,
    vehicleInfo,
    videoFiles,
    visibleTabs,
  } = props; // receive page logic props.

  switch (props.view) { // choose the page section requested by logic.
    case "section1":
      return <div style={{
  minHeight: "100vh",
  background: "var(--surface-light)",
  padding: "24px 16px"
}}>
        <SkeletonKeyframes />
        <div style={{
    maxWidth: 820,
    margin: "0 auto",
    display: "flex",
    flexDirection: "column",
    gap: 16
  }}>
          <div style={{
      display: "flex",
      alignItems: "center",
      gap: 12
    }}>
            <SkeletonBlock width="140px" height="40px" />
            <div style={{
        flex: 1
      }} />
            <SkeletonBlock width="120px" height="32px" borderRadius="999px" />
          </div>
          <div style={{
      background: "var(--surface)",
      borderRadius: "var(--radius-md)",
      padding: 20,
      display: "flex",
      flexDirection: "column",
      gap: 10
    }}>
            <SkeletonBlock width="60%" height="22px" />
            <SkeletonBlock width="80%" height="12px" />
            <SkeletonBlock width="50%" height="12px" />
          </div>
          {Array.from({
      length: 3
    }).map((_, i) => <div key={i} style={{
      background: "var(--surface)",
      borderRadius: "var(--radius-md)",
      padding: 20,
      display: "flex",
      flexDirection: "column",
      gap: 10
    }}>
              <SkeletonBlock width="40%" height="16px" />
              <SkeletonBlock width="100%" height="12px" />
              <SkeletonBlock width="90%" height="12px" />
              <SkeletonBlock width="70%" height="12px" />
            </div>)}
        </div>
      </div>; // render extracted page section.

    case "section2":
      return <div style={{
  minHeight: "100vh",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "var(--surface-light)"
}}>
        <div style={{
    textAlign: "center",
    padding: "24px"
  }}>
          <div style={{
      fontSize: "18px",
      fontWeight: 600,
      color: "var(--accent-purple)",
      marginBottom: "8px"
    }}>Error Loading Job</div>
          <div style={{
      fontSize: "14px",
      color: "var(--info)",
      marginBottom: "24px"
    }}>{error}</div>
          <button onClick={handleBack} style={{
      padding: "12px 24px",
      background: "var(--primary)",
      color: "var(--surface)",
      border: "none",
      borderRadius: "var(--radius-sm)",
      fontWeight: 600,
      cursor: "pointer"
    }}>
            Go Back
          </button>
        </div>
      </div>; // render extracted page section.

    case "section3":
      return <>
      <Head>
        <title>Vehicle Health Check - Job #{jobNumber}</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <div style={{
    minHeight: "100vh",
    background: "var(--surface-light)"
  }}>
        {/* Header */}
        <header style={{
      background: "var(--surface)",
      borderBottom: "1px solid var(--info-surface)",
      padding: "16px 24px",
      position: "sticky",
      top: 0,
      zIndex: 100
    }}>
          <div style={{
        maxWidth: "1200px",
        margin: "0 auto",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: "24px"
      }}>
            {/* Logo on the left */}
            <div style={{
          flexShrink: 0
        }}>
              <BrandLogo alt="HP Logo" width={120} height={50} style={{
            objectFit: "contain"
          }} />
            </div>

            {/* Vehicle and Customer Details in the middle */}
            <div style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          gap: "4px"
        }}>
              <h1 style={{
            fontSize: "18px",
            fontWeight: 700,
            color: "var(--accent-purple)",
            margin: 0
          }}>
                Vehicle Health Check
              </h1>
              <div style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "16px",
            fontSize: "13px",
            color: "var(--info-dark)"
          }}>
                <span style={{
              fontWeight: 600
            }}>Job #{jobNumber}</span>
                {vehicleInfo?.registration && <span style={{
              display: "flex",
              alignItems: "center",
              gap: "4px"
            }}>
                    <span style={{
                color: "var(--info)"
              }}>Reg:</span>
                    <span style={{
                fontWeight: 600
              }}>{vehicleInfo.registration}</span>
                  </span>}
                {(vehicleInfo?.make || vehicleInfo?.model) && <span style={{
              display: "flex",
              alignItems: "center",
              gap: "4px"
            }}>
                    <span style={{
                color: "var(--info)"
              }}>Vehicle:</span>
                    <span>{[vehicleInfo.make, vehicleInfo.model].filter(Boolean).join(" ")}</span>
                  </span>}
                {customerInfo?.name && <span style={{
              display: "flex",
              alignItems: "center",
              gap: "4px"
            }}>
                    <span style={{
                color: "var(--info)"
              }}>Customer:</span>
                    <span>{customerInfo.name}</span>
                  </span>}
              </div>
            </div>

            {/* Back button on the right */}
            <button onClick={handleBack} style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          padding: "10px 20px",
          background: "var(--surface)",
          color: "var(--accent-purple)",
          border: "1px solid var(--accent-purple-surface)",
          borderRadius: "var(--radius-sm)",
          fontWeight: 600,
          cursor: "pointer",
          fontSize: "14px",
          flexShrink: 0
        }}>
              ← Back
            </button>
          </div>
        </header>

        {/* Tab Navigation */}
        <div style={{
      background: "var(--surface)",
      borderBottom: "1px solid var(--info-surface)"
    }}>
          <div style={{
        maxWidth: "1200px",
        margin: "0 auto",
        padding: "0 24px"
      }}>
            <div style={{
          display: "flex",
          gap: "8px"
        }}>
              {visibleTabs.map(tab => <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
            padding: "16px 24px",
            background: "transparent",
            border: "none",
            borderBottom: activeTab === tab.id ? "3px solid var(--primary)" : "3px solid transparent",
            fontWeight: activeTab === tab.id ? 700 : 500,
            fontSize: "14px",
            color: activeTab === tab.id ? "var(--primary)" : "var(--info)",
            cursor: "pointer",
            transition: "all 0.2s ease"
          }}>
                  {tab.label}
                  {tab.id === "photos" && photoFiles.length > 0 && <span style={{
              marginLeft: "8px",
              background: "var(--info-surface)",
              padding: "2px 8px",
              borderRadius: "var(--radius-sm)",
              fontSize: "12px"
            }}>
                      {photoFiles.length}
                    </span>}
                  {tab.id === "videos" && videoFiles.length > 0 && <span style={{
              marginLeft: "8px",
              background: "var(--info-surface)",
              padding: "2px 8px",
              borderRadius: "var(--radius-sm)",
              fontSize: "12px"
            }}>
                      {videoFiles.length}
                    </span>}
                </button>)}
            </div>
          </div>
        </div>

        {/* Main Content */}
        <main style={{
      maxWidth: "1200px",
      margin: "0 auto",
      padding: "24px"
    }}>
          {activeTab === "summary" && renderSummaryTab()}
          {activeTab === "photos" && renderPhotosTab()}
          {activeTab === "videos" && renderVideosTab()}
        </main>

        {/* Footer */}
        <footer style={{
      background: "var(--surface)",
      borderTop: "1px solid var(--info-surface)",
      padding: "16px 24px",
      marginTop: "auto"
    }}>
          <div style={{
        maxWidth: "1200px",
        margin: "0 auto",
        textAlign: "center"
      }}>
            <div style={{
          fontSize: "12px",
          color: "var(--info)"
        }}>
              Vehicle Health Check Report • Job #{jobNumber}
            </div>
          </div>
        </footer>
      </div>
    </>; // render extracted page section.
    default:
      return null; // keep unknown sections visually empty.
  }
}
