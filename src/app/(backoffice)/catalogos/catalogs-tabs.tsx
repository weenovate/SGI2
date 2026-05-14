"use client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CatalogEditor } from "@/components/catalog-editor";
import { api } from "@/lib/trpc/react";

export function CatalogsTabs({ canRestore }: { canRestore: boolean }) {
  return (
    <Tabs defaultValue="titulaciones">
      <TabsList>
        <TabsTrigger value="titulaciones">Titulaciones</TabsTrigger>
        <TabsTrigger value="sindicatos">Sindicatos</TabsTrigger>
        <TabsTrigger value="categorias">Categorías</TabsTrigger>
        <TabsTrigger value="tipos-doc">Tipos de Documentación</TabsTrigger>
        <TabsTrigger value="motivos-doc">Motivos rechazo doc</TabsTrigger>
        <TabsTrigger value="motivos-insc">Motivos rechazo inscripción</TabsTrigger>
        <TabsTrigger value="tipos-doc-id">Tipos de Documento de Identidad</TabsTrigger>
      </TabsList>

      <TabsContent value="titulaciones">
        <Titulaciones canRestore={canRestore} />
      </TabsContent>
      <TabsContent value="sindicatos">
        <Sindicatos canRestore={canRestore} />
      </TabsContent>
      <TabsContent value="categorias">
        <Categorias canRestore={canRestore} />
      </TabsContent>
      <TabsContent value="tipos-doc">
        <TiposDoc canRestore={canRestore} />
      </TabsContent>
      <TabsContent value="motivos-doc">
        <MotivosDoc />
      </TabsContent>
      <TabsContent value="motivos-insc">
        <MotivosInsc />
      </TabsContent>
      <TabsContent value="tipos-doc-id">
        <TiposDocId />
      </TabsContent>
    </Tabs>
  );
}

function Titulaciones({ canRestore }: { canRestore: boolean }) {
  const utils = api.useUtils();
  const list = api.titulaciones.list.useQuery({ includeDeleted: true });
  const create = api.titulaciones.create.useMutation({ onSuccess: () => utils.titulaciones.list.invalidate() });
  const update = api.titulaciones.update.useMutation({ onSuccess: () => utils.titulaciones.list.invalidate() });
  const del = api.titulaciones.softDelete.useMutation({ onSuccess: () => utils.titulaciones.list.invalidate() });
  const restore = api.titulaciones.restore.useMutation({ onSuccess: () => utils.titulaciones.list.invalidate() });
  return (
    <CatalogEditor
      title="Titulaciones"
      description="Cargos / titulaciones náuticas (Anexo D)."
      items={list.data ?? []}
      fields={[
        { key: "label", label: "Nombre", required: true },
        { key: "active", label: "Activa", type: "boolean" },
      ]}
      onCreate={async (data) => { await create.mutateAsync({ label: String(data.label) }); }}
      onUpdate={async (id, data) => { await update.mutateAsync({ id, label: String(data.label), active: Boolean(data.active) }); }}
      onDelete={async (id) => { await del.mutateAsync({ id }); }}
      onRestore={canRestore ? async (id) => { await restore.mutateAsync({ id }); } : undefined}
    />
  );
}

function Sindicatos({ canRestore }: { canRestore: boolean }) {
  const utils = api.useUtils();
  const list = api.sindicatos.list.useQuery({ includeDeleted: true });
  const create = api.sindicatos.create.useMutation({ onSuccess: () => utils.sindicatos.list.invalidate() });
  const update = api.sindicatos.update.useMutation({ onSuccess: () => utils.sindicatos.list.invalidate() });
  const del = api.sindicatos.softDelete.useMutation({ onSuccess: () => utils.sindicatos.list.invalidate() });
  const restore = api.sindicatos.restore.useMutation({ onSuccess: () => utils.sindicatos.list.invalidate() });
  return (
    <CatalogEditor
      title="Sindicatos"
      description="Sindicatos del sector náutico (Anexo E)."
      items={list.data ?? []}
      fields={[
        { key: "sigla", label: "Sigla", required: true },
        { key: "label", label: "Nombre completo", required: true },
        { key: "active", label: "Activo", type: "boolean" },
      ]}
      onCreate={async (data) => { await create.mutateAsync({ sigla: String(data.sigla), label: String(data.label) }); }}
      onUpdate={async (id, data) => { await update.mutateAsync({ id, sigla: String(data.sigla), label: String(data.label), active: Boolean(data.active) }); }}
      onDelete={async (id) => { await del.mutateAsync({ id }); }}
      onRestore={canRestore ? async (id) => { await restore.mutateAsync({ id }); } : undefined}
    />
  );
}

function Categorias({ canRestore }: { canRestore: boolean }) {
  const utils = api.useUtils();
  const list = api.categorias.list.useQuery({ includeDeleted: true });
  const create = api.categorias.create.useMutation({ onSuccess: () => utils.categorias.list.invalidate() });
  const update = api.categorias.update.useMutation({ onSuccess: () => utils.categorias.list.invalidate() });
  const del = api.categorias.softDelete.useMutation({ onSuccess: () => utils.categorias.list.invalidate() });
  const restore = api.categorias.restore.useMutation({ onSuccess: () => utils.categorias.list.invalidate() });
  return (
    <CatalogEditor
      title="Categorías de curso"
      items={list.data ?? []}
      fields={[
        { key: "label", label: "Nombre", required: true },
        { key: "color", label: "Color (hex opcional)", placeholder: "#0ea5e9" },
        { key: "active", label: "Activa", type: "boolean" },
      ]}
      onCreate={async (data) => { await create.mutateAsync({ label: String(data.label), color: data.color ? String(data.color) : undefined }); }}
      onUpdate={async (id, data) => { await update.mutateAsync({ id, label: String(data.label), color: data.color ? String(data.color) : null, active: Boolean(data.active) }); }}
      onDelete={async (id) => { await del.mutateAsync({ id }); }}
      onRestore={canRestore ? async (id) => { await restore.mutateAsync({ id }); } : undefined}
    />
  );
}

function TiposDoc({ canRestore }: { canRestore: boolean }) {
  const utils = api.useUtils();
  const list = api.tiposDocumentacion.list.useQuery({ includeDeleted: true });
  const create = api.tiposDocumentacion.create.useMutation({ onSuccess: () => utils.tiposDocumentacion.list.invalidate() });
  const update = api.tiposDocumentacion.update.useMutation({ onSuccess: () => utils.tiposDocumentacion.list.invalidate() });
  const del = api.tiposDocumentacion.softDelete.useMutation({ onSuccess: () => utils.tiposDocumentacion.list.invalidate() });
  const restore = api.tiposDocumentacion.restore.useMutation({ onSuccess: () => utils.tiposDocumentacion.list.invalidate() });
  return (
    <CatalogEditor
      title="Tipos de Documentación"
      description="Anexo B."
      items={list.data ?? []}
      fields={[
        { key: "code", label: "Código", required: true },
        { key: "label", label: "Nombre", required: true },
        { key: "hasExpiry", label: "Tiene vencimiento", type: "boolean" },
        { key: "isProfilePhoto", label: "Es foto de perfil", type: "boolean" },
        { key: "active", label: "Activo", type: "boolean" },
      ]}
      onCreate={async (data) => { await create.mutateAsync({ code: String(data.code), label: String(data.label), hasExpiry: Boolean(data.hasExpiry), isProfilePhoto: Boolean(data.isProfilePhoto) }); }}
      onUpdate={async (id, data) => { await update.mutateAsync({ id, code: String(data.code), label: String(data.label), hasExpiry: Boolean(data.hasExpiry), isProfilePhoto: Boolean(data.isProfilePhoto), active: Boolean(data.active) }); }}
      onDelete={async (id) => { await del.mutateAsync({ id }); }}
      onRestore={canRestore ? async (id) => { await restore.mutateAsync({ id }); } : undefined}
    />
  );
}

function MotivosDoc() {
  const utils = api.useUtils();
  const list = api.motivos.doc.list.useQuery();
  const create = api.motivos.doc.create.useMutation({ onSuccess: () => utils.motivos.doc.list.invalidate() });
  const update = api.motivos.doc.update.useMutation({ onSuccess: () => utils.motivos.doc.list.invalidate() });
  const del = api.motivos.doc.softDelete.useMutation({ onSuccess: () => utils.motivos.doc.list.invalidate() });
  return (
    <CatalogEditor
      title="Motivos de rechazo de documentación"
      description="Anexo H."
      items={list.data ?? []}
      fields={[
        { key: "label", label: "Motivo", required: true },
        { key: "active", label: "Activo", type: "boolean" },
      ]}
      onCreate={async (data) => { await create.mutateAsync({ label: String(data.label) }); }}
      onUpdate={async (id, data) => { await update.mutateAsync({ id, label: String(data.label), active: Boolean(data.active) }); }}
      onDelete={async (id) => { await del.mutateAsync({ id }); }}
    />
  );
}

function MotivosInsc() {
  const utils = api.useUtils();
  const list = api.motivos.inscripcion.list.useQuery();
  const create = api.motivos.inscripcion.create.useMutation({ onSuccess: () => utils.motivos.inscripcion.list.invalidate() });
  const update = api.motivos.inscripcion.update.useMutation({ onSuccess: () => utils.motivos.inscripcion.list.invalidate() });
  const del = api.motivos.inscripcion.softDelete.useMutation({ onSuccess: () => utils.motivos.inscripcion.list.invalidate() });
  return (
    <CatalogEditor
      title="Motivos de rechazo de inscripción"
      description="Anexo I."
      items={list.data ?? []}
      fields={[
        { key: "label", label: "Motivo", required: true },
        { key: "active", label: "Activo", type: "boolean" },
      ]}
      onCreate={async (data) => { await create.mutateAsync({ label: String(data.label) }); }}
      onUpdate={async (id, data) => { await update.mutateAsync({ id, label: String(data.label), active: Boolean(data.active) }); }}
      onDelete={async (id) => { await del.mutateAsync({ id }); }}
    />
  );
}

function TiposDocId() {
  const utils = api.useUtils();
  const list = api.tiposDocId.list.useQuery();
  const create = api.tiposDocId.create.useMutation({ onSuccess: () => utils.tiposDocId.list.invalidate() });
  const update = api.tiposDocId.update.useMutation({ onSuccess: () => utils.tiposDocId.list.invalidate() });
  const del = api.tiposDocId.softDelete.useMutation({ onSuccess: () => utils.tiposDocId.list.invalidate() });
  return (
    <CatalogEditor
      title="Tipos de Documento de Identidad"
      description="Anexo G."
      items={list.data ?? []}
      fields={[
        { key: "code", label: "Código", required: true },
        { key: "label", label: "Nombre", required: true },
        { key: "active", label: "Activo", type: "boolean" },
      ]}
      onCreate={async (data) => { await create.mutateAsync({ code: String(data.code), label: String(data.label) }); }}
      onUpdate={async (id, data) => { await update.mutateAsync({ id, code: String(data.code), label: String(data.label), active: Boolean(data.active) }); }}
      onDelete={async (id) => { await del.mutateAsync({ id }); }}
    />
  );
}
