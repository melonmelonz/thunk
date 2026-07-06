//! The content model: a Module is an ordered set of Lessons.

use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
pub struct ModuleId(pub String);

#[derive(Clone, Debug, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
pub struct LessonId(pub String);

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct Lesson {
    pub id: LessonId,
    pub title: String,
    pub body: String,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct Module {
    pub id: ModuleId,
    pub title: String,
    pub lessons: Vec<Lesson>,
}

impl Module {
    pub fn lesson_ids(&self) -> Vec<LessonId> {
        self.lessons.iter().map(|l| l.id.clone()).collect()
    }
    pub fn lesson(&self, id: &LessonId) -> Option<&Lesson> {
        self.lessons.iter().find(|l| &l.id == id)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn module_lists_lessons_in_order() {
        let m = Module {
            id: ModuleId("m1-kernel".into()),
            title: "The Kernel".into(),
            lessons: vec![
                Lesson { id: LessonId("01".into()), title: "Programs and the OS".into(), body: "text".into() },
                Lesson { id: LessonId("02".into()), title: "Syscalls".into(), body: "text".into() },
            ],
        };
        assert_eq!(m.lesson_ids(), vec![LessonId("01".into()), LessonId("02".into())]);
        assert_eq!(m.lesson(&LessonId("02".into())).unwrap().title, "Syscalls");
        assert!(m.lesson(&LessonId("99".into())).is_none());
    }
}
