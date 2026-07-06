//! thunk domain logic. Pure, offline, no I/O beyond what callers pass in.

pub mod check;
pub mod content;
pub mod progress;

pub use check::{Answer, Check, CheckId, Verdict};
pub use content::{Lesson, LessonId, Module, ModuleId};
pub use progress::Progress;
